/**
 * 🧪 PMO LOGIN TEST UTILITY 🧪
 * 
 * Use this script to quickly login and test PMO page functionality
 * 
 * INSTRUCTIONS:
 * 1. Open browser console (F12) on http://localhost:3000
 * 2. Copy and paste this entire script
 * 3. Press Enter to execute
 * 4. Wait for automatic login and redirect to PMO
 */

console.log('🧪 Starting PMO login test...');

// Clear any existing auth data first
console.log('🧹 Clearing existing auth data...');
localStorage.removeItem('rpa_token');
localStorage.removeItem('rpa_user');
localStorage.removeItem('rpa-auth-storage');

// Admin login credentials
const loginData = {
  email: 'admin@rpa.com',
  password: 'admin123'
};

console.log('🔐 Attempting login with admin credentials...');

// Login API call
fetch('http://localhost:8001/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(loginData)
})
.then(response => response.json())
.then(data => {
  if (data.token && data.user) {
    console.log('✅ Login successful!');
    console.log('👤 User:', data.user.full_name, `(${data.user.role})`);
    
    // Store auth data
    localStorage.setItem('rpa_token', data.token);
    localStorage.setItem('rpa_user', JSON.stringify(data.user));
    
    // Create Zustand auth storage
    const authStorage = {
      state: {
        user: data.user,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
        permissions: []
      },
      version: 0
    };
    localStorage.setItem('rpa-auth-storage', JSON.stringify(authStorage));
    
    console.log('💾 Auth data stored in localStorage');
    console.log('🎯 Redirecting to PMO page...');
    
    // Wait a moment then redirect to PMO
    setTimeout(() => {
      window.location.href = 'http://localhost:3000/pmo';
    }, 1500);
    
  } else {
    console.error('❌ Login failed:', data);
  }
})
.catch(error => {
  console.error('❌ Network error during login:', error);
  console.log('🔧 Make sure backend is running on port 8001');
});