const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

async function checkAndAddIdeas() {
    console.log('Checking database for existing data...\n');

    // Check existing ideas
    db.all('SELECT * FROM ideas', [], (err, rows) => {
        if (err) {
            console.error('Error checking ideas:', err);
            return;
        }
        console.log(`Current ideas in database: ${rows.length}`);
        if (rows.length > 0) {
            console.log('Existing ideas:');
            rows.forEach(idea => {
                console.log(`  - ${idea.id}: ${idea.title} (${idea.status})`);
            });
        }
        console.log('\n');
    });

    // Get projects
    db.all('SELECT id, name FROM projects ORDER BY id LIMIT 10', [], (err, projects) => {
        if (err) {
            console.error('Error getting projects:', err);
            return;
        }
        console.log('Available projects:');
        projects.forEach(p => console.log(`  - ${p.id}: ${p.name}`));
        console.log('\n');

        // Get users
        db.all('SELECT id, username, full_name, role FROM users ORDER BY id LIMIT 10', [], (err, users) => {
            if (err) {
                console.error('Error getting users:', err);
                return;
            }
            console.log('Available users:');
            users.forEach(u => console.log(`  - ${u.id}: ${u.full_name} (${u.role})`));
            console.log('\n');

            // Find the first team_lead or admin user
            const creator = users.find(u => u.role === 'team_lead') || users[0];

            if (!creator) {
                console.error('No users found in database!');
                db.close();
                return;
            }

            console.log(`Using creator: ${creator.full_name} (ID: ${creator.id})\n`);

            // Define the 5 example ideas
            const exampleIdeas = [
                {
                    title: 'Automatizar reporte de producción diaria',
                    description: 'Implementar un RPA que genere automáticamente reportes diarios de producción en AGROSUPER, consolidando datos de múltiples sistemas y enviando resúmenes por email a los gerentes. Esto eliminaría 2-3 horas diarias de trabajo manual y reduciría errores en la consolidación de datos.',
                    category: 'automation',
                    impact_score: 5,
                    effort_score: 3,
                    status: 'under_review'
                },
                {
                    title: 'Bot para conciliación de inventario de productos marinos',
                    description: 'Desarrollar un bot que reconcilie automáticamente el inventario de productos marinos en CAMANCHACA entre el sistema ERP y el sistema de warehouse management. El proceso actual toma 4-5 horas semanales y es propenso a errores debido a diferencias en formatos de datos.',
                    category: 'automation',
                    impact_score: 4,
                    effort_score: 2,
                    status: 'approved'
                },
                {
                    title: 'RPA para seguimiento de órdenes de compra',
                    description: 'Automatizar el seguimiento de órdenes de compra en COAGRA, enviando notificaciones automáticas a proveedores cuando hay retrasos y actualizando el estado en el sistema ERP. Esto mejoraría la visibilidad de la cadena de suministro y reduciría tiempos de respuesta.',
                    category: 'process_improvement',
                    impact_score: 4,
                    effort_score: 3,
                    status: 'draft'
                },
                {
                    title: 'Automatización de reportes financieros mensuales',
                    description: 'Crear un RPA en RAM que extraiga datos financieros de múltiples fuentes, genere reportes mensuales estandarizados y los distribuya automáticamente a stakeholders. El proceso manual actual consume 6-8 horas mensuales del equipo financiero.',
                    category: 'cost_reduction',
                    impact_score: 5,
                    effort_score: 4,
                    status: 'in_progress'
                },
                {
                    title: 'Bot para gestión de solicitudes de mantenimiento',
                    description: 'Implementar un bot en PROMET que automatice la recepción, clasificación y asignación de solicitudes de mantenimiento. El bot categorizaría las solicitudes por prioridad, verificaría disponibilidad de técnicos y enviaría notificaciones automáticas, reduciendo tiempos de respuesta en 40%.',
                    category: 'productivity',
                    impact_score: 4,
                    effort_score: 2,
                    status: 'approved'
                }
            ];

            // Insert ideas
            const stmt = db.prepare(`
                INSERT INTO ideas (
                    title, description, category, impact_score, effort_score,
                    status, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            let insertedCount = 0;
            exampleIdeas.forEach((idea, index) => {
                stmt.run([
                    idea.title,
                    idea.description,
                    idea.category,
                    idea.impact_score,
                    idea.effort_score,
                    idea.status,
                    creator.id
                ], function(err) {
                    if (err) {
                        console.error(`Error inserting idea ${index + 1}:`, err.message);
                    } else {
                        insertedCount++;
                        console.log(`✓ Inserted: "${idea.title}" (ID: ${this.lastID})`);
                    }

                    // When all ideas are processed, verify and close
                    if (index === exampleIdeas.length - 1) {
                        stmt.finalize();

                        setTimeout(() => {
                            db.all('SELECT id, title, status, category, priority_score FROM ideas ORDER BY id', [], (err, rows) => {
                                if (err) {
                                    console.error('Error verifying ideas:', err);
                                } else {
                                    console.log(`\n✓ Successfully inserted ${insertedCount} example ideas!`);
                                    console.log('\nAll ideas in database:');
                                    rows.forEach(idea => {
                                        console.log(`  - ${idea.id}: ${idea.title}`);
                                        console.log(`    Status: ${idea.status}, Category: ${idea.category}, Priority: ${idea.priority_score}`);
                                    });
                                }
                                db.close();
                            });
                        }, 100);
                    }
                });
            });
        });
    });
}

// Run the function
checkAndAddIdeas();
