const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Database - Use the same dynamic selection as in server.js
let db;
if (process.env.USE_PG === 'true') {
  db = require('../models/pgAdapter');
} else {
  db = require('../models/database');
}

// Get Stripe publishable key
router.get('/config', (req, res) => {
  res.json({
    publishableKey: process.env.VITE_STRIPE_PUBLIC_KEY || null
  });
});

// Create a payment intent for one-time purchases
router.post('/create-payment-intent', verifyToken, async (req, res) => {
  try {
    const { amount, packageId } = req.body;
    
    if (!amount || !packageId) {
      return res.status(400).json({ error: 'Amount and package ID are required' });
    }
    
    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      // Store metadata about the package and user for verification later
      metadata: {
        packageId,
        userId: req.user.id
      }
    });
    
    res.json({
      clientSecret: paymentIntent.client_secret
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

// Verify payment and update user balance
router.get('/verify/:paymentIntentId', verifyToken, async (req, res) => {
  try {
    const { paymentIntentId } = req.params;
    
    // Retrieve the payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment has not been completed' 
      });
    }
    
    // Verify that the payment is for this user
    if (paymentIntent.metadata.userId !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Payment verification failed: user mismatch' 
      });
    }
    
    // Determine how many coins to add based on the package
    const packageId = paymentIntent.metadata.packageId;
    let coinsToAdd = 0;
    
    switch (packageId) {
      case 'small':
        coinsToAdd = 100;
        break;
      case 'medium':
        coinsToAdd = 500;
        break;
      case 'large':
        coinsToAdd = 1200;
        break;
      case 'premium':
        coinsToAdd = 100; // Initial premium bonus
        // Here you would also set the user as premium, update subscription status, etc.
        break;
      default:
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid package ID' 
        });
    }
    
    // Load the current user to get their balance
    const user = await db.users.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // Calculate new balance and update user
    const newBalance = (user.balance || 0) + coinsToAdd;
    await db.users.update(req.user.id, { balance: newBalance });
    
    // If this is a premium subscription, update user's premium status
    if (packageId === 'premium') {
      // Here you would update the user's premium status, subscription end date, etc.
      // For example: await updateUserPremiumStatus(req.user.id, true, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    }
    
    res.json({
      success: true,
      message: 'Payment verified and account updated',
      coinsAdded: coinsToAdd,
      newBalance: newBalance
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to verify payment' 
    });
  }
});

// Get available packages
router.get('/packages', (req, res) => {
  const packages = [
    {
      id: 'small',
      name: 'Small Coin Pack',
      price: 199, // in cents
      coins: 100,
      description: 'Perfect for casual users'
    },
    {
      id: 'medium',
      name: 'Medium Coin Pack',
      price: 799, // in cents
      coins: 500,
      description: 'Great value for regular users'
    },
    {
      id: 'large',
      name: 'Large Coin Pack',
      price: 1499, // in cents
      coins: 1200,
      description: 'Best value for power users'
    },
    {
      id: 'premium',
      name: 'Premium Membership',
      price: 499, // in cents
      type: 'subscription',
      benefits: [
        'Exclusive profile badge',
        'Ad-free experience',
        '100 coins monthly bonus',
        'Priority support'
      ]
    }
  ];
  
  res.json(packages);
});

module.exports = router;