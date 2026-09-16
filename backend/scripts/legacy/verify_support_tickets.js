const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

async function runQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function verifyTickets() {
  console.log('=== VERIFYING SUPPORT TICKETS ===\n');

  try {
    // Get all companies
    const companies = await runQuery('SELECT * FROM support_companies');
    console.log('SUPPORT COMPANIES:\n');
    companies.forEach(company => {
      console.log(`  ${company.id}. ${company.company_name}`);
      console.log(`     Email: ${company.contact_email}`);
      console.log(`     Phone: ${company.contact_phone}`);
      console.log(`     Monthly Hours: ${company.monthly_hours_contracted}h`);
      console.log(`     Hourly Rate: CLP $${company.hourly_rate}`);
      console.log(`     Extra Rate: CLP $${company.hourly_rate_extra}`);
      console.log(`     Status: ${company.status}`);
      console.log('');
    });

    console.log('\nSUPPORT TICKETS:\n');

    // Get all tickets with company info
    const tickets = await runQuery(`
      SELECT
        st.*,
        sc.company_name,
        u.full_name as resolver_name
      FROM support_tickets st
      LEFT JOIN support_companies sc ON st.company_id = sc.id
      LEFT JOIN users u ON st.resolver_id = u.id
      ORDER BY st.work_date DESC
    `);

    tickets.forEach(ticket => {
      console.log(`  ${ticket.id}`);
      console.log(`     Company: ${ticket.company_name}`);
      console.log(`     Title: ${ticket.title}`);
      console.log(`     Type: ${ticket.ticket_type} | Priority: ${ticket.priority}`);
      console.log(`     Status: ${ticket.status}`);
      console.log(`     Hours Spent: ${ticket.hours_spent}h`);
      console.log(`     Work Date: ${ticket.work_date}`);
      console.log(`     Completion Date: ${ticket.completion_date || 'N/A'}`);
      console.log(`     Assigned To: ${ticket.resolver_name || 'Unassigned'}`);
      console.log(`     Description: ${ticket.description.substring(0, 80)}...`);
      console.log('');
    });

    console.log('\n=== SUMMARY ===');
    console.log(`Total Companies: ${companies.length}`);
    console.log(`Total Tickets: ${tickets.length}`);

    const statusCounts = tickets.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {});

    console.log('Tickets by Status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  - ${status}: ${count}`);
    });

  } catch (error) {
    console.error('Error verifying tickets:', error);
  } finally {
    db.close();
  }
}

verifyTickets();
