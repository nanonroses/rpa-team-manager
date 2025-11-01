import { db } from '../database/database';
import { logger } from '../utils/logger';

async function verifySeededData() {
    try {
        await db.connect();

        // Get latest 5 projects
        const projects = await db.query(`
            SELECT id, name, status, priority, budget, progress_percentage, assigned_to
            FROM projects
            ORDER BY id DESC
            LIMIT 5
        `);

        // Count tasks for these projects
        const tasks = await db.query(`
            SELECT COUNT(*) as count
            FROM tasks
            WHERE board_id IN (
                SELECT id FROM task_boards
                WHERE project_id IN (
                    SELECT id FROM projects ORDER BY id DESC LIMIT 5
                )
            )
        `);

        // Count milestones
        const milestones = await db.query(`
            SELECT COUNT(*) as count
            FROM project_milestones
            WHERE project_id IN (
                SELECT id FROM projects ORDER BY id DESC LIMIT 5
            )
        `);

        // Count financials
        const financials = await db.query(`
            SELECT COUNT(*) as count
            FROM project_financials
            WHERE project_id IN (
                SELECT id FROM projects ORDER BY id DESC LIMIT 5
            )
        `);

        // Get task distribution by status
        const tasksByStatus = await db.query(`
            SELECT t.status, COUNT(*) as count
            FROM tasks t
            WHERE t.board_id IN (
                SELECT id FROM task_boards
                WHERE project_id IN (
                    SELECT id FROM projects ORDER BY id DESC LIMIT 5
                )
            )
            GROUP BY t.status
            ORDER BY count DESC
        `);

        // Get user assignments
        const userAssignments = await db.query(`
            SELECT u.username, u.full_name, COUNT(DISTINCT p.id) as projects_assigned
            FROM users u
            LEFT JOIN projects p ON p.assigned_to = u.id
            WHERE p.id IN (SELECT id FROM projects ORDER BY id DESC LIMIT 5)
            GROUP BY u.id, u.username, u.full_name
            ORDER BY projects_assigned DESC
        `);

        console.log('\n========================================');
        console.log('DATABASE SEED VERIFICATION REPORT');
        console.log('========================================\n');

        console.log('PROJECTS CREATED (Latest 5):');
        console.log('----------------------------');
        projects.forEach((p: any) => {
            console.log(`  ${p.name}`);
            console.log(`    Status: ${p.status} | Priority: ${p.priority} | Progress: ${p.progress_percentage}%`);
            console.log(`    Budget: $${p.budget.toLocaleString()}`);
            console.log('');
        });

        console.log('DATA SUMMARY:');
        console.log('----------------------------');
        console.log(`  Total Projects: ${projects.length}`);
        console.log(`  Total Tasks: ${tasks[0].count}`);
        console.log(`  Total Milestones: ${milestones[0].count}`);
        console.log(`  Total Financial Records: ${financials[0].count}`);
        console.log('');

        console.log('TASK DISTRIBUTION BY STATUS:');
        console.log('----------------------------');
        tasksByStatus.forEach((ts: any) => {
            console.log(`  ${ts.status}: ${ts.count} tasks`);
        });
        console.log('');

        console.log('PROJECT ASSIGNMENTS:');
        console.log('----------------------------');
        userAssignments.forEach((ua: any) => {
            console.log(`  ${ua.full_name} (${ua.username}): ${ua.projects_assigned} project(s)`);
        });
        console.log('');

        console.log('========================================');
        console.log('VERIFICATION COMPLETE');
        console.log('========================================\n');

        return {
            projects: projects.length,
            tasks: tasks[0].count,
            milestones: milestones[0].count,
            financials: financials[0].count
        };

    } catch (error) {
        logger.error('Error verifying seeded data:', error);
        throw error;
    }
}

// Execute if run directly
if (require.main === module) {
    verifySeededData()
        .then(() => {
            logger.info('Verification completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('Verification failed:', error);
            process.exit(1);
        });
}

export { verifySeededData };
