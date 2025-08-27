/**
 * ⚠️  EMERGENCY AUTH DATA CLEANUP UTILITY ⚠️ 
 * 
 * Use this script when authentication data is corrupted and causing PMO login issues.
 * This will completely clear all authentication-related data from localStorage.
 * 
 * INSTRUCTIONS:
 * 1. Open browser console (F12) on http://localhost:3000
 * 2. Copy and paste this entire script
 * 3. Press Enter to execute
 * 4. Refresh the page
 * 5. Login again
 */

console.log('🧹 Starting emergency auth data cleanup...');

// List of all known auth-related localStorage keys
const authKeys = [
  'rpa_token',
  'rpa_user', 
  'rpa-auth-storage',
  'rpa-auth-state',
  'authToken',
  'userToken',
  'user',
  'token'
];

let clearedKeys = [];
let foundKeys = [];

// Check what's currently stored
authKeys.forEach(key => {
  const value = localStorage.getItem(key);
  if (value !== null) {
    foundKeys.push(key);
    console.log(`🔍 Found auth key: ${key} = ${value.substring(0, 50)}...`);
  }
});

if (foundKeys.length === 0) {
  console.log('✅ No auth data found in localStorage');
} else {
  console.log(`📋 Found ${foundKeys.length} auth-related keys to clean`);
  
  // Clear all auth keys
  authKeys.forEach(key => {
    try {
      localStorage.removeItem(key);
      clearedKeys.push(key);
    } catch (error) {
      console.error(`❌ Error clearing key ${key}:`, error);
    }
  });
  
  // Also clear any keys that might contain JWT patterns
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key);
      if (value && (
        value.includes('Bearer ') ||
        value.includes('eyJ') || // JWT header starts with eyJ
        value.includes('"token"') ||
        value.includes('"user"') ||
        value.includes('"isAuthenticated"')
      )) {
        console.log(`🔍 Found JWT-like data in key: ${key}`);
        try {
          localStorage.removeItem(key);
          clearedKeys.push(key);
        } catch (error) {
          console.error(`❌ Error clearing JWT key ${key}:`, error);
        }
      }
    }
  }
  
  console.log(`✅ Cleared ${clearedKeys.length} auth-related keys:`, clearedKeys);
}

// Clear sessionStorage as well
const sessionAuthKeys = ['rpa_token', 'rpa_user', 'token', 'user'];
sessionAuthKeys.forEach(key => {
  if (sessionStorage.getItem(key)) {
    sessionStorage.removeItem(key);
    console.log(`🧹 Cleared sessionStorage key: ${key}`);
  }
});

// Force a hard refresh to clear any in-memory state
console.log('🔄 Auth data cleanup complete. Reloading page...');
console.log('💡 After reload, you should be redirected to login page');
console.log('🎯 Try accessing /pmo after logging in again');

// Wait a moment for console messages to appear
setTimeout(() => {
  window.location.reload(true);
}, 2000);