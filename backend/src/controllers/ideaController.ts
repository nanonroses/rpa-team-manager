import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { db } from '../database/database';
import { logger } from '../utils/logger';

export class IdeaController {

    // GET /api/ideas
    getIdeas = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { status, category, sort = 'priority' } = req.query;

            let query = `
                SELECT i.*, 
                       u1.full_name as created_by_name,
                       u2.full_name as assigned_to_name,
                       uv.vote_type as user_vote
                FROM ideas i
                LEFT JOIN users u1 ON i.created_by = u1.id
                LEFT JOIN users u2 ON i.assigned_to = u2.id
                LEFT JOIN idea_votes uv ON i.id = uv.idea_id AND uv.user_id = ?
                WHERE 1=1
            `;

            const params: any[] = [req.user?.id];

            // Filter by status
            if (status && status !== 'all') {
                query += ' AND i.status = ?';
                params.push(status);
            }

            // Filter by category
            if (category && category !== 'all') {
                query += ' AND i.category = ?';
                params.push(category);
            }

            // Sorting
            switch (sort) {
                case 'priority':
                    query += ' ORDER BY i.priority_score DESC, i.votes_count DESC, i.created_at DESC';
                    break;
                case 'votes':
                    query += ' ORDER BY i.votes_count DESC, i.created_at DESC';
                    break;
                case 'recent':
                    query += ' ORDER BY i.created_at DESC';
                    break;
                case 'oldest':
                    query += ' ORDER BY i.created_at ASC';
                    break;
                default:
                    query += ' ORDER BY i.priority_score DESC, i.votes_count DESC, i.created_at DESC';
            }

            const ideas = await db.query(query, params);
            res.json(ideas);
        } catch (error) {
            logger.error('Get ideas error:', error);
            res.status(500).json({ error: 'Failed to get ideas' });
        }
    };

    // GET /api/ideas/:id
    getIdea = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;

            const idea = await db.get(`
                SELECT i.*, 
                       u1.full_name as created_by_name,
                       u2.full_name as assigned_to_name,
                       uv.vote_type as user_vote
                FROM ideas i
                LEFT JOIN users u1 ON i.created_by = u1.id
                LEFT JOIN users u2 ON i.assigned_to = u2.id
                LEFT JOIN idea_votes uv ON i.id = uv.idea_id AND uv.user_id = ?
                WHERE i.id = ?
            `, [req.user?.id, id]);

            if (!idea) {
                res.status(404).json({ error: 'Idea not found' });
                return;
            }

            res.json(idea);
        } catch (error) {
            logger.error('Get idea error:', error);
            res.status(500).json({ error: 'Failed to get idea' });
        }
    };

    // POST /api/ideas
    createIdea = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { 
                title, 
                description, 
                category = 'general',
                impact_score = 3,
                effort_score = 3,
                status = 'draft'
            } = req.body;

            // Validation
            if (!title || title.trim().length < 3) {
                res.status(400).json({ error: 'Title must be at least 3 characters long' });
                return;
            }

            if (!description || description.trim().length < 10) {
                res.status(400).json({ error: 'Description must be at least 10 characters long' });
                return;
            }

            const result = await db.run(`
                INSERT INTO ideas (
                    title, description, category, impact_score, effort_score, 
                    status, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [title.trim(), description.trim(), category, impact_score, effort_score, status, req.user?.id]);

            const ideaId = result.id!;

            // Get the created idea with details
            const createdIdea = await db.get(`
                SELECT i.*, u.full_name as created_by_name
                FROM ideas i
                LEFT JOIN users u ON i.created_by = u.id
                WHERE i.id = ?
            `, [ideaId]);

            logger.info(`Idea created: ${title} by ${req.user?.email}`);
            res.status(201).json(createdIdea);
        } catch (error) {
            logger.error('Create idea error:', error);
            res.status(500).json({ error: 'Failed to create idea' });
        }
    };

    // PUT /api/ideas/:id
    updateIdea = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Get current idea
            const currentIdea = await db.get('SELECT * FROM ideas WHERE id = ?', [id]);
            if (!currentIdea) {
                res.status(404).json({ error: 'Idea not found' });
                return;
            }

            // Check permissions - only creator or team_lead can edit
            if (currentIdea.created_by !== req.user?.id && req.user?.role !== 'team_lead') {
                res.status(403).json({ error: 'Only the creator or team lead can edit this idea' });
                return;
            }

            // Prepare update fields
            const allowedFields = ['title', 'description', 'category', 'impact_score', 'effort_score', 'status', 'assigned_to'];
            const updateFields = Object.keys(updates).filter(key => allowedFields.includes(key));

            if (updateFields.length === 0) {
                res.status(400).json({ error: 'No valid fields to update' });
                return;
            }

            const setClause = updateFields.map(field => `${field} = ?`).join(', ');
            const values = updateFields.map(field => updates[field]);
            values.push(id);

            await db.run(`
                UPDATE ideas 
                SET ${setClause}, updated_at = datetime('now')
                WHERE id = ?
            `, values);

            // Get updated idea with details
            const updatedIdea = await db.get(`
                SELECT i.*, 
                       u1.full_name as created_by_name,
                       u2.full_name as assigned_to_name
                FROM ideas i
                LEFT JOIN users u1 ON i.created_by = u1.id
                LEFT JOIN users u2 ON i.assigned_to = u2.id
                WHERE i.id = ?
            `, [id]);

            logger.info(`Idea updated: ${updatedIdea.title} by ${req.user?.email}`);
            res.json(updatedIdea);
        } catch (error) {
            logger.error('Update idea error:', error);
            res.status(500).json({ error: 'Failed to update idea' });
        }
    };

    // DELETE /api/ideas/:id
    deleteIdea = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;

            // Get current idea
            const idea = await db.get('SELECT * FROM ideas WHERE id = ?', [id]);
            if (!idea) {
                res.status(404).json({ error: 'Idea not found' });
                return;
            }

            // Check permissions - only creator or team_lead can delete
            if (idea.created_by !== req.user?.id && req.user?.role !== 'team_lead') {
                res.status(403).json({ error: 'Only the creator or team lead can delete this idea' });
                return;
            }

            await db.run('DELETE FROM ideas WHERE id = ?', [id]);

            logger.info(`Idea deleted: ${idea.title} by ${req.user?.email}`);
            res.json({ message: 'Idea deleted successfully' });
        } catch (error) {
            logger.error('Delete idea error:', error);
            res.status(500).json({ error: 'Failed to delete idea' });
        }
    };

    // POST /api/ideas/:id/vote
    voteIdea = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const { vote_type = 'up' } = req.body;

            if (!['up', 'down'].includes(vote_type)) {
                res.status(400).json({ error: 'Vote type must be "up" or "down"' });
                return;
            }

            // Check if idea exists
            const idea = await db.get('SELECT id FROM ideas WHERE id = ?', [id]);
            if (!idea) {
                res.status(404).json({ error: 'Idea not found' });
                return;
            }

            // Check if user already voted
            const existingVote = await db.get('SELECT * FROM idea_votes WHERE idea_id = ? AND user_id = ?', [id, req.user?.id]);

            if (existingVote) {
                if (existingVote.vote_type === vote_type) {
                    // Remove vote if same type
                    await db.run('DELETE FROM idea_votes WHERE idea_id = ? AND user_id = ?', [id, req.user?.id]);
                    res.json({ message: 'Vote removed', vote_type: null });
                } else {
                    // Update vote type
                    await db.run('UPDATE idea_votes SET vote_type = ? WHERE idea_id = ? AND user_id = ?', [vote_type, id, req.user?.id]);
                    res.json({ message: 'Vote updated', vote_type });
                }
            } else {
                // Create new vote
                await db.run('INSERT INTO idea_votes (idea_id, user_id, vote_type) VALUES (?, ?, ?)', [id, req.user?.id, vote_type]);
                res.json({ message: 'Vote created', vote_type });
            }

            logger.info(`User ${req.user?.email} voted ${vote_type} on idea ${id}`);
        } catch (error) {
            logger.error('Vote idea error:', error);
            res.status(500).json({ error: 'Failed to vote on idea' });
        }
    };

    // GET /api/ideas/:id/comments
    getIdeaComments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;

            const comments = await db.query(`
                SELECT ic.*, u.full_name as user_name, u.avatar_url
                FROM idea_comments ic
                LEFT JOIN users u ON ic.user_id = u.id
                WHERE ic.idea_id = ?
                ORDER BY ic.created_at ASC
            `, [id]);

            res.json(comments);
        } catch (error) {
            logger.error('Get idea comments error:', error);
            res.status(500).json({ error: 'Failed to get comments' });
        }
    };

    // POST /api/ideas/:id/comments
    createIdeaComment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const { comment } = req.body;

            if (!comment || comment.trim().length < 3) {
                res.status(400).json({ error: 'Comment must be at least 3 characters long' });
                return;
            }

            // Check if idea exists
            const idea = await db.get('SELECT id FROM ideas WHERE id = ?', [id]);
            if (!idea) {
                res.status(404).json({ error: 'Idea not found' });
                return;
            }

            const result = await db.run(`
                INSERT INTO idea_comments (idea_id, user_id, comment) 
                VALUES (?, ?, ?)
            `, [id, req.user?.id, comment.trim()]);

            // Get the created comment with user details
            const createdComment = await db.get(`
                SELECT ic.*, u.full_name as user_name, u.avatar_url
                FROM idea_comments ic
                LEFT JOIN users u ON ic.user_id = u.id
                WHERE ic.id = ?
            `, [result.id]);

            logger.info(`Comment added to idea ${id} by ${req.user?.email}`);
            res.status(201).json(createdComment);
        } catch (error) {
            logger.error('Create idea comment error:', error);
            res.status(500).json({ error: 'Failed to create comment' });
        }
    };

    // GET /api/ideas/stats
    getIdeaStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const stats = await db.get(`
                SELECT 
                    COUNT(*) as total_ideas,
                    COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_count,
                    COUNT(CASE WHEN status = 'under_review' THEN 1 END) as under_review_count,
                    COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
                    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_count,
                    COUNT(CASE WHEN status = 'done' THEN 1 END) as done_count,
                    COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
                    AVG(votes_count) as avg_votes,
                    MAX(votes_count) as max_votes
                FROM ideas
            `);

            const categoryStats = await db.query(`
                SELECT category, COUNT(*) as count
                FROM ideas
                GROUP BY category
                ORDER BY count DESC
            `);

            res.json({
                ...stats,
                categories: categoryStats
            });
        } catch (error) {
            logger.error('Get idea stats error:', error);
            res.status(500).json({ error: 'Failed to get idea statistics' });
        }
    };
}