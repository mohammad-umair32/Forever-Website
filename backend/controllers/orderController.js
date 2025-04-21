import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import Stripe from 'stripe';
import razorpay from 'razorpay';
import nodemailer from 'nodemailer';

// Global variables
const currency = 'inr';
const deliveryCharge = 100;

// Gateway initialize
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const razorpayInstance = new razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Function to send order confirmation email
const sendOrderEmail = async (userEmail, orderDetails) => {
    let itemsHtml = '';
    if (orderDetails.items && orderDetails.items.length > 0) {
        itemsHtml = '<ul>';
        orderDetails.items.forEach(item => {
            itemsHtml += `<li>${item.name} (Size: ${item.size ? item.size : 'N/A'}) - ₹${item.price} x ${item.quantity}</li>`;
        });
        itemsHtml += '</ul>';
    }

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: userEmail,
        subject: 'Order Confirmation',
        html: `<h3>Thank you for your order!</h3>
               <p>Your order has been placed successfully.</p>
               <p><b>Order ID:</b> ${orderDetails._id}</p>
               <p><b>Payment Method:</b> ${orderDetails.paymentMethod}</p>
               <p><b>Total Amount:</b> ₹${orderDetails.amount}</p>
               <p><b>Delivery Address:</b> ${orderDetails.address.street}, ${orderDetails.address.city}, ${orderDetails.address.state}, ${orderDetails.address.zipcode}, ${orderDetails.address.country}</p>
               <h4>Order Details:</h4>
               ${itemsHtml}
               <p>We will notify you when your order is shipped.</p>`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log("Order confirmation email sent to:", userEmail);
    } catch (error) {
        console.error("Error sending email:", error);
    }
};

// Placing orders using COD Method
const placeOrder = async (req, res) => {
    try {
        // Expect email field for confirmation
        const { userId, items, amount, address, email } = req.body;

        const orderData = {
            userId,
            items,
            address,
            amount,
            paymentMethod: "COD",
            payment: false,
            date: Date.now(),
            email
        };

        const newOrder = new orderModel(orderData);
        await newOrder.save();

        await userModel.findByIdAndUpdate(userId, { cartData: {} });

        // Send confirmation email immediately for COD orders
        if (email) {
            await sendOrderEmail(email, newOrder);
        }

        res.json({ success: true, message: "Order Placed & Email Sent" });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// Placing orders using Stripe Method
const placeOrderStripe = async (req, res) => {
    try {
        // Include email in the request body
        const { userId, items, amount, address, email } = req.body;
        const { origin } = req.headers;

        const orderData = {
            userId,
            items,
            address,
            amount,
            paymentMethod: "Stripe",
            payment: false,
            date: Date.now(),
            email
        };

        const newOrder = new orderModel(orderData);
        await newOrder.save();

        const line_items = items.map((item) => ({
            price_data: {
                currency: currency,
                product_data: { name: item.name },
                unit_amount: item.price * 100
            },
            quantity: item.quantity
        }));

        line_items.push({
            price_data: {
                currency: currency,
                product_data: { name: 'Delivery Charges' },
                unit_amount: deliveryCharge * 100
            },
            quantity: 1
        });

        const session = await stripe.checkout.sessions.create({
            success_url: `${origin}/verify?success=true&orderId=${newOrder._id}`,
            cancel_url: `${origin}/verify?success=false&orderId=${newOrder._id}`,
            line_items,
            mode: 'payment'
        });
        if (email) {
            await sendOrderEmail(email, newOrder);
        }

        // Don't send email here; wait until payment is verified
        res.json({ success: true, session_url: session.url });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// Verify Stripe Payment and send email confirmation
const verifyStripe = async (req, res) => {
    const { orderId, success, userId } = req.body;
    try {
        if (success === "true") {
            await orderModel.findByIdAndUpdate(orderId, { payment: true });
            await userModel.findByIdAndUpdate(userId, { cartData: {} });
            const order = await orderModel.findById(orderId);
            if (order.email) {
                await sendOrderEmail(order.email, order);
            }
            res.json({ success: true });
        } else {
            await orderModel.findByIdAndDelete(orderId);
            res.json({ success: false });
        }
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// Placing orders using Razorpay Method
const placeOrderRazorpay = async (req, res) => {
    try {
        // Include email in the request body
        const { userId, items, amount, address, email } = req.body;

        const orderData = {
            userId,
            items,
            address,
            amount,
            paymentMethod: "Razorpay",
            payment: false,
            date: Date.now(),
            email
        };

        const newOrder = new orderModel(orderData);
        await newOrder.save();

        const options = {
            amount: amount * 100,
            currency: currency.toUpperCase(),
            receipt: newOrder._id.toString()
        };
        if (email) {
            await sendOrderEmail(email, newOrder);
        }

        await razorpayInstance.orders.create(options, (error, order) => {
            if (error) {
                console.log(error);
                return res.json({ success: false, message: error });
            }
            res.json({ success: true, order });
        });
        
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// Verify Razorpay Payment and send email confirmation
const verifyRazorpay = async (req, res) => {
    try {
        const { userId, razorpay_order_id } = req.body;

        const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id);
        if (orderInfo.status === 'paid') {
            await orderModel.findByIdAndUpdate(orderInfo.receipt, { payment: true });
            await userModel.findByIdAndUpdate(userId, { cartData: {} });
            const order = await orderModel.findById(orderInfo.receipt);
            if (order.email) {
                await sendOrderEmail(order.email, order);
            }
            res.json({ success: true, message: "Payment Successful" });
        } else {
            res.json({ success: false, message: 'Payment Failed' });
        }
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// All Orders data for Admin Panel
const allOrders = async (req, res) => {
    try {
        const orders = await orderModel.find({});
        res.json({ success: true, orders });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// User Order Data for Frontend
const userOrders = async (req, res) => {
    try {
        const { userId } = req.body;
        const orders = await orderModel.find({ userId });
        res.json({ success: true, orders });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// Update order status from Admin Panel
const updateStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;
        await orderModel.findByIdAndUpdate(orderId, { status });
        res.json({ success: true, message: 'Status Updated' });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

export { verifyRazorpay, verifyStripe, placeOrder, placeOrderStripe, placeOrderRazorpay, allOrders, userOrders, updateStatus };