const http = require('http');

// Configuration
const BASE_URL = 'http://localhost:3001';
const TEST_CREDENTIALS = {
  email: 'admin@rpa.com',
  password: 'admin123'
};

let authToken = null;

function makeRequest(path, method = 'GET', data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function login() {
  console.log('🔐 Logging in as admin...');
  const response = await makeRequest('/api/auth/login', 'POST', TEST_CREDENTIALS);

  if (response.status === 200 && response.data.token) {
    authToken = response.data.token;
    console.log(`✅ Login successful! Token: ${authToken.substring(0, 20)}...`);
    return true;
  } else {
    console.log(`❌ Login failed:`, response);
    return false;
  }
}

async function testBoard(boardId) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing Board ID: ${boardId}`);
  console.log('='.repeat(60));

  const response = await makeRequest(`/api/tasks/boards/${boardId}`, 'GET', null, authToken);

  if (response.status === 200) {
    const board = response.data;
    console.log(`✅ Board: "${board.name}"`);
    console.log(`   Project: ${board.project_name}`);
    console.log(`   Columns: ${board.columns?.length || 0}`);
    console.log(`   Tasks: ${board.tasks?.length || 0}`);

    if (board.tasks && board.tasks.length > 0) {
      console.log(`\n   Tasks returned by API:`);
      board.tasks.forEach(task => {
        console.log(`      - [${task.id}] "${task.title}" (column_id: ${task.column_id})`);
      });

      // Check task distribution by column
      console.log(`\n   Tasks by column:`);
      const tasksByColumn = {};
      board.tasks.forEach(task => {
        if (!tasksByColumn[task.column_id]) {
          tasksByColumn[task.column_id] = [];
        }
        tasksByColumn[task.column_id].push(task);
      });

      board.columns.forEach(col => {
        const count = tasksByColumn[col.id]?.length || 0;
        console.log(`      - ${col.name}: ${count} tasks`);
      });
    }

    return board.tasks?.length || 0;
  } else if (response.status === 404) {
    console.log(`❌ Board ${boardId} not found or access denied`);
    return 0;
  } else {
    console.log(`❌ Error fetching board ${boardId}:`, response);
    return 0;
  }
}

async function runTests() {
  console.log('🧪 RPA Team Manager - Live API Test');
  console.log('=' .repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Testing with: ${TEST_CREDENTIALS.email}`);
  console.log('='.repeat(60));

  // Step 1: Login
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.log('\n❌ Cannot proceed without authentication');
    process.exit(1);
  }

  // Step 2: Test all boards
  const boardIds = [3, 4, 5, 31, 32];
  let totalTasks = 0;

  for (const boardId of boardIds) {
    const taskCount = await testBoard(boardId);
    totalTasks += taskCount;
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total tasks accessible via API: ${totalTasks} / 22`);

  if (totalTasks === 22) {
    console.log('✅ SUCCESS: All tasks are being returned by the API!');
    console.log('\n💡 If tasks are not showing in the frontend:');
    console.log('   1. Check browser console for errors');
    console.log('   2. Verify the frontend is using the correct board IDs');
    console.log('   3. Check if tasks are being filtered out by React rendering');
    console.log('   4. Clear browser cache and reload');
  } else {
    console.log(`❌ PROBLEM: Only ${totalTasks} tasks returned, missing ${22 - totalTasks} tasks`);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('\n❌ Test failed with error:', error);
  process.exit(1);
});
