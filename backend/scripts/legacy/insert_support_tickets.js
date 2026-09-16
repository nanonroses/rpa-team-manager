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

async function runExec(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

async function insertSupportTicketsAndCompanies() {
  console.log('Starting support tickets and companies insertion...\n');

  try {
    // Check existing projects
    console.log('Checking existing projects...');
    const projects = await runQuery('SELECT id, name FROM projects ORDER BY id LIMIT 5');
    console.log(`Found ${projects.length} projects:`);
    projects.forEach(p => console.log(`  - ${p.id}: ${p.name}`));
    console.log('');

    if (projects.length === 0) {
      console.log('No projects found! Please run seed data first.');
      return;
    }

    // Check existing support companies
    console.log('Checking existing support companies...');
    const existingCompanies = await runQuery('SELECT id, company_name FROM support_companies');
    console.log(`Found ${existingCompanies.length} existing companies.\n`);

    // Check existing support tickets
    const existingTickets = await runQuery('SELECT COUNT(*) as count FROM support_tickets');
    console.log(`Found ${existingTickets[0].count} existing support tickets.\n`);

    // Get admin user
    const adminUser = await runQuery('SELECT id FROM users WHERE role = ? LIMIT 1', ['team_lead']);
    if (!adminUser || adminUser.length === 0) {
      console.log('No admin user found!');
      return;
    }
    const adminUserId = adminUser[0].id;
    console.log(`Admin user ID: ${adminUserId}\n`);

    // Get developers
    const developers = await runQuery('SELECT id, full_name FROM users WHERE role = ?', ['rpa_developer']);
    console.log(`Found ${developers.length} developers for assignment.\n`);

    // Create support companies for the 5 projects (if they don't exist)
    const companiesToCreate = [
      {
        name: 'AGROSUPER',
        contactEmail: 'roberto.martinez@agrosuper.cl',
        contactPhone: '+56912345001',
        monthlyHours: 30,
        hourlyRate: 65000,
        hourlyRateExtra: 75000
      },
      {
        name: 'CAMANCHACA',
        contactEmail: 'patricia.munoz@camanchaca.cl',
        contactPhone: '+56912345002',
        monthlyHours: 20,
        hourlyRate: 60000,
        hourlyRateExtra: 70000
      },
      {
        name: 'COAGRA',
        contactEmail: 'luis.fernandez@coagra.cl',
        contactPhone: '+56912345003',
        monthlyHours: 25,
        hourlyRate: 70000,
        hourlyRateExtra: 80000
      },
      {
        name: 'RAM',
        contactEmail: 'carmen.soto@ram.cl',
        contactPhone: '+56912345004',
        monthlyHours: 15,
        hourlyRate: 55000,
        hourlyRateExtra: 65000
      },
      {
        name: 'PROMET',
        contactEmail: 'diego.vargas@promet.cl',
        contactPhone: '+56912345005',
        monthlyHours: 20,
        hourlyRate: 60000,
        hourlyRateExtra: 70000
      }
    ];

    const createdCompanies = [];

    for (const company of companiesToCreate) {
      // Check if company already exists
      const existing = await runQuery(
        'SELECT id, company_name FROM support_companies WHERE company_name = ?',
        [company.name]
      );

      if (existing && existing.length > 0) {
        console.log(`Company ${company.name} already exists (ID: ${existing[0].id})`);
        createdCompanies.push({ id: existing[0].id, name: company.name });
      } else {
        // Create new company
        const result = await runExec(`
          INSERT INTO support_companies (
            company_name, contact_email, contact_phone,
            monthly_hours_contracted, hourly_rate, hourly_rate_extra,
            status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `, [
          company.name,
          company.contactEmail,
          company.contactPhone,
          company.monthlyHours,
          company.hourlyRate,
          company.hourlyRateExtra,
          'active'
        ]);

        console.log(`Created company: ${company.name} (ID: ${result.id})`);
        createdCompanies.push({ id: result.id, name: company.name });
      }
    }
    console.log('');

    // Create 5 example support tickets
    // Valid ticket_type: 'support', 'maintenance', 'development', 'consultation'
    // Valid priority: 'low', 'medium', 'high', 'urgent'
    const ticketsToCreate = [
      {
        companyName: 'AGROSUPER',
        title: 'Bot no procesa archivos Excel corruptos',
        ticketType: 'support',
        attentionMethod: 'Remote',
        description: 'El bot de Toma de Control no procesa correctamente archivos Excel con formato corrupto o con celdas combinadas. Se detiene en la validación inicial y genera error 500.',
        status: 'in_progress',
        priority: 'high',
        hoursSpent: 2.0,
        workDate: '2025-01-15',
        completionDate: null
      },
      {
        companyName: 'CAMANCHACA',
        title: 'Agregar validación de peso en recepción',
        ticketType: 'development',
        attentionMethod: 'Email',
        description: 'Solicitud de nueva funcionalidad: Agregar validación automática de peso en el proceso de recepción de pescado. El sistema debe alertar si el peso registrado difiere en más del 5% del peso esperado.',
        status: 'open',
        priority: 'medium',
        hoursSpent: 0,
        workDate: '2025-01-20',
        completionDate: null
      },
      {
        companyName: 'COAGRA',
        title: 'Solicitud de acceso nuevo usuario',
        ticketType: 'consultation',
        attentionMethod: 'FreshDesk',
        description: 'Solicitud de acceso para nuevo usuario al sistema de conciliación bancaria. Usuario: Ana González, Cargo: Analista Contable. Requiere permisos de solo lectura. Solución: Se creó el usuario con email ana.gonzalez@coagra.cl con permisos de solo lectura.',
        status: 'resolved',
        priority: 'low',
        hoursSpent: 0.5,
        workDate: '2025-01-18',
        completionDate: '2025-01-18'
      },
      {
        companyName: 'RAM',
        title: 'Error en cálculo de diferencias bancarias',
        ticketType: 'support',
        attentionMethod: 'Phone',
        description: 'Error crítico en el cálculo de diferencias en conciliación bancaria. El bot está sumando incorrectamente cuando hay múltiples transacciones del mismo monto en un día. Se requiere revisión urgente.',
        status: 'in_progress',
        priority: 'urgent',
        hoursSpent: 3.0,
        workDate: '2025-01-22',
        completionDate: null
      },
      {
        companyName: 'PROMET',
        title: 'Implementar notificaciones por email',
        ticketType: 'development',
        attentionMethod: 'Remote',
        description: 'Implementar sistema de notificaciones por email cuando el bot de Housekeeping complete tareas programadas. Incluir resumen de tareas ejecutadas y cualquier error encontrado.',
        status: 'open',
        priority: 'medium',
        hoursSpent: 0,
        workDate: '2025-01-21',
        completionDate: null
      }
    ];

    console.log('Creating support tickets...\n');
    let ticketsCreated = 0;

    for (let i = 0; i < ticketsToCreate.length; i++) {
      const ticket = ticketsToCreate[i];

      // Find company ID
      const company = createdCompanies.find(c => c.name === ticket.companyName);
      if (!company) {
        console.log(`Company ${ticket.companyName} not found, skipping ticket...`);
        continue;
      }

      // Assign to a random developer if in_progress or resolved
      let resolverId = null;
      if (ticket.status !== 'open' && developers.length > 0) {
        const randomDev = developers[Math.floor(Math.random() * developers.length)];
        resolverId = randomDev.id;
      }

      // Generate ticket ID
      const ticketCount = await runQuery('SELECT COUNT(*) as count FROM support_tickets WHERE company_id = ?', [company.id]);
      const ticketNumber = ticketCount[0].count + 1;
      const ticketId = `${company.name}-${String(ticketNumber).padStart(3, '0')}`;

      try {
        await runExec(`
          INSERT INTO support_tickets (
            id, company_id, title, description, ticket_type, attention_method,
            status, priority, created_by, resolver_id, hours_spent,
            work_date, completion_date, resolved_at,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `, [
          ticketId,
          company.id,
          ticket.title,
          ticket.description,
          ticket.ticketType,
          ticket.attentionMethod,
          ticket.status,
          ticket.priority,
          adminUserId,
          resolverId,
          ticket.hoursSpent,
          ticket.workDate,
          ticket.completionDate,
          ticket.status === 'resolved' ? ticket.completionDate : null
        ]);

        console.log(`Created ticket: ${ticketId} - ${ticket.companyName} - ${ticket.ticketType} - ${ticket.status}`);
        ticketsCreated++;
      } catch (error) {
        console.error(`Error creating ticket for ${ticket.companyName}:`, error.message);
      }
    }

    console.log(`\nSuccessfully created ${ticketsCreated} support tickets!`);

    // Show summary
    console.log('\n=== SUMMARY ===');
    const totalCompanies = await runQuery('SELECT COUNT(*) as count FROM support_companies');
    const totalTickets = await runQuery('SELECT COUNT(*) as count FROM support_tickets');
    const openTickets = await runQuery('SELECT COUNT(*) as count FROM support_tickets WHERE status = "open"');
    const inProgressTickets = await runQuery('SELECT COUNT(*) as count FROM support_tickets WHERE status = "in_progress"');
    const resolvedTickets = await runQuery('SELECT COUNT(*) as count FROM support_tickets WHERE status IN ("resolved", "closed")');

    console.log(`Total Support Companies: ${totalCompanies[0].count}`);
    console.log(`Total Support Tickets: ${totalTickets[0].count}`);
    console.log(`  - Open: ${openTickets[0].count}`);
    console.log(`  - In Progress: ${inProgressTickets[0].count}`);
    console.log(`  - Resolved/Closed: ${resolvedTickets[0].count}`);

  } catch (error) {
    console.error('Error inserting support tickets:', error);
  } finally {
    db.close();
  }
}

insertSupportTicketsAndCompanies();
