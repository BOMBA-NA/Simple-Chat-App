/**
 * Payments functionality for ArcadeTalk
 * This module handles premium features and coin purchases
 */

// Check if Stripe.js is loaded
let stripeInstance = null;
let elements = null;
let paymentElement = null;
let hasStripeConfig = false;

// Initialize the payments system
async function setupPayments() {
  // Check if we have payment config
  try {
    const response = await fetchWithAuth('/api/payments/config');
    const data = await response.json();
    
    if (data.publishableKey) {
      hasStripeConfig = true;
      
      // Load Stripe.js dynamically
      if (!window.Stripe) {
        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3/';
        script.async = true;
        document.head.appendChild(script);
        
        // Wait for script to load
        await new Promise(resolve => {
          script.onload = resolve;
        });
      }
      
      // Initialize Stripe
      stripeInstance = Stripe(data.publishableKey);
      console.log('Payment system initialized');
    } else {
      console.log('Payment system not configured');
    }
  } catch (error) {
    console.error('Error initializing payment system:', error);
  }
  
  // Add event listeners for premium buttons
  const premiumButtons = document.querySelectorAll('.premium-btn');
  premiumButtons.forEach(button => {
    button.addEventListener('click', () => {
      const packageId = button.getAttribute('data-package');
      const amount = button.getAttribute('data-amount');
      showPaymentModal(packageId, amount);
    });
  });
}

// Show payment modal
function showPaymentModal(packageId, amount) {
  if (!hasStripeConfig) {
    showToast('Error', 'Payment system is not available at this time.');
    return;
  }
  
  // Create modal HTML
  const modalHtml = `
    <div class="modal fade" id="paymentModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Purchase Coins</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="package-details mb-4">
              <h6>Package Details</h6>
              <p class="package-name">${getPackageName(packageId)}</p>
              <p class="package-price">$${(amount / 100).toFixed(2)}</p>
            </div>
            
            <div id="payment-element-container">
              <div id="payment-element"></div>
              <button id="submit-payment" class="btn btn-primary mt-3">Pay Now</button>
              <div id="payment-message" class="hidden"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Add modal to the DOM
  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = modalHtml;
  document.body.appendChild(modalContainer);
  
  // Show the modal
  const paymentModal = new bootstrap.Modal(document.getElementById('paymentModal'));
  paymentModal.show();
  
  // Initialize Stripe Elements
  initializePaymentElement(packageId, amount);
  
  // Clean up when modal is closed
  document.getElementById('paymentModal').addEventListener('hidden.bs.modal', () => {
    if (elements) {
      paymentElement = null;
      elements = null;
    }
    modalContainer.remove();
  });
}

// Initialize Stripe Elements
async function initializePaymentElement(packageId, amount) {
  try {
    // Create PaymentIntent on the server
    const response = await fetchWithAuth('/api/payments/create-payment-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amount / 100, // Convert from cents to dollars
        packageId: packageId
      }),
    });
    
    const { clientSecret } = await response.json();
    
    if (!clientSecret) {
      showToast('Error', 'Could not initialize payment. Please try again.');
      return;
    }
    
    // Initialize Stripe Elements
    elements = stripeInstance.elements({
      clientSecret,
      appearance: {
        theme: 'stripe',
        variables: {
          colorPrimary: '#8a2be2',
          colorBackground: '#ffffff',
          colorText: '#30313d',
          colorDanger: '#df1b41',
          fontFamily: 'Roboto, Open Sans, Segoe UI, sans-serif',
          spacingUnit: '4px',
          borderRadius: '8px',
        },
      },
    });
    
    // Create and mount the Payment Element
    paymentElement = elements.create('payment');
    paymentElement.mount('#payment-element');
    
    // Handle form submission
    const submitButton = document.getElementById('submit-payment');
    const messageContainer = document.getElementById('payment-message');
    
    submitButton.addEventListener('click', async () => {
      submitButton.disabled = true;
      messageContainer.textContent = '';
      messageContainer.classList.remove('alert', 'alert-danger');
      
      const { error } = await stripeInstance.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-success`,
        },
      });
      
      if (error) {
        messageContainer.textContent = error.message;
        messageContainer.classList.add('alert', 'alert-danger');
        submitButton.disabled = false;
      }
    });
  } catch (error) {
    console.error('Error initializing payment:', error);
    showToast('Error', 'Payment initialization failed. Please try again.');
  }
}

// Get package name from ID
function getPackageName(packageId) {
  const packages = {
    'small': 'Small Coin Pack (100 coins)',
    'medium': 'Medium Coin Pack (500 coins)',
    'large': 'Large Coin Pack (1200 coins)',
    'premium': 'Premium Membership (1 month)'
  };
  
  return packages[packageId] || 'Coin Package';
}

// Handle payment success
function handlePaymentSuccess() {
  const urlParams = new URLSearchParams(window.location.search);
  const paymentIntentId = urlParams.get('payment_intent');
  
  if (paymentIntentId) {
    // Call backend to verify payment
    fetchWithAuth(`/api/payments/verify/${paymentIntentId}`)
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          showToast('Success', 'Payment successful! Your account has been updated.');
          // Update user balance in the UI
          refreshUserData();
        } else {
          showToast('Error', 'There was an issue with your payment. Please contact support.');
        }
      })
      .catch(error => {
        console.error('Error verifying payment:', error);
        showToast('Error', 'Could not verify payment. Please contact support.');
      });
  }
}