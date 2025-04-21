import React from 'react'
import { assets } from '../assets/assets'

const Footer = () => {
    return (
        <div>
            <div className='flex flex-col sm:grid grid-cols-[3fr_1fr_1fr] gap-14 my-10 mt-40 text-sm'>
                <div>
                    <img src={assets.logo} className='mb-5 w-32' alt='' />
                    <p className='w-full md:w-2/3 text-gray-600'>
                        Forever is more than just fashion—it's a way of life. We bring you timeless styles, modern fits, and everyday essentials made to elevate your wardrobe. Whether you're dressing for comfort or confidence, our collections are designed to keep you looking your best, always.
                    </p>
                </div>
                <div>
                    <p className='text-xl font-medium mb-5'>COMPANY</p>
                    <ul className='flex flex-col gap-1 text-gray-600'>
                        <a href='/'>Home</a>
                        <a href='/about'>About us</a>
                        <a href='/orders'>Delivery</a>
                        <a href='/contact'>Privacy policy</a>
                    </ul>
                </div>
                <div>
                    <p className='text-xl font-medium mb-5'>GET IN TOUCH</p>
                    <ul className='flex flex-col gap-1 text-gray-600'>
                        <li>+1-212-456-7890</li>
                        <li>contaxt.teamforever@gmail.com</li>
                    </ul>
                </div>
            </div>
            <div>
                <hr />
                <p className='py-5 text-sm text-center'>Copyright 2024@ forever.com - All Right Reserved.</p>
            </div>
        </div>
    )
}

export default Footer
