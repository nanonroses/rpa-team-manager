import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { db } from '../database/database';
import { logger } from '../utils/logger';
import { activityLogService } from '../services/activityLogService';

const canManage = (role?: string) => role === 'team_lead' || role === 'rpa_operations';

export class CostCenterController {
  listCostCenters = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { country, is_rpa, active_only } = req.query;
      const conditions: string[] = [];
      const params: any[] = [];

      if (country) {
        conditions.push('country = ?');
        params.push(String(country).toUpperCase());
      }

      if (is_rpa !== undefined && is_rpa !== '') {
        conditions.push('is_rpa = ?');
        params.push(is_rpa === 'true' || is_rpa === '1' ? 1 : 0);
      }

      if (active_only === 'true' || active_only === '1' || active_only === undefined) {
        conditions.push('is_active = 1');
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = await db.query(
        `SELECT * FROM cost_centers ${whereClause} ORDER BY country ASC, is_rpa DESC, name ASC`,
        params
      );

      res.json({ data: rows });
    } catch (error) {
      logger.error('Error al listar centros de costos:', error);
      res.status(500).json({ error: 'Error al obtener centros de costos' });
    }
  };

  getCostCenterById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const row = await db.get('SELECT * FROM cost_centers WHERE id = ?', [id]);
      if (!row) {
        res.status(404).json({ error: 'Centro de costo no encontrado' });
        return;
      }
      res.json({ data: row });
    } catch (error) {
      logger.error('Error al obtener centro de costo:', error);
      res.status(500).json({ error: 'Error al obtener centro de costo' });
    }
  };

  createCostCenter = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (req.user?.role !== 'team_lead') {
        res.status(403).json({ error: 'Solo la jefatura puede crear centros de costos' });
        return;
      }

      const { code, name, country, category, is_rpa = false } = req.body;
      if (!code?.trim() || !name?.trim() || !country) {
        res.status(400).json({ error: 'El código, nombre y país son obligatorios' });
        return;
      }

      const normalizedCountry = String(country).toUpperCase();
      if (!['CHILE', 'PERU', 'USA'].includes(normalizedCountry)) {
        res.status(400).json({ error: 'País no válido. Debe ser CHILE, PERU o USA' });
        return;
      }

      const existing = await db.get('SELECT id FROM cost_centers WHERE code = ?', [code.trim().toUpperCase()]);
      if (existing) {
        res.status(409).json({ error: `El código ${code.trim().toUpperCase()} ya está registrado` });
        return;
      }

      const result = await db.run(
        `INSERT INTO cost_centers (code, name, country, category, is_rpa, is_active)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [code.trim().toUpperCase(), name.trim(), normalizedCountry, category?.trim() || 'GENERAL', is_rpa ? 1 : 0]
      );

      const created = await db.get('SELECT * FROM cost_centers WHERE id = ?', [result.id]);
      res.status(201).json({ data: created });
    } catch (error) {
      logger.error('Error al crear centro de costo:', error);
      res.status(500).json({ error: 'Error al crear centro de costo' });
    }
  };

  updateCostCenter = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (req.user?.role !== 'team_lead') {
        res.status(403).json({ error: 'Solo la jefatura puede actualizar centros de costos' });
        return;
      }

      const id = Number(req.params.id);
      const existing = await db.get('SELECT * FROM cost_centers WHERE id = ?', [id]);
      if (!existing) {
        res.status(404).json({ error: 'Centro de costo no encontrado' });
        return;
      }

      const { name, category, is_rpa, is_active } = req.body;
      const updates: string[] = [];
      const values: any[] = [];

      if (name !== undefined) {
        updates.push('name = ?');
        values.push(name.trim());
      }
      if (category !== undefined) {
        updates.push('category = ?');
        values.push(category.trim());
      }
      if (is_rpa !== undefined) {
        updates.push('is_rpa = ?');
        values.push(is_rpa ? 1 : 0);
      }
      if (is_active !== undefined) {
        updates.push('is_active = ?');
        values.push(is_active ? 1 : 0);
      }

      if (!updates.length) {
        res.status(400).json({ error: 'No se enviaron campos para actualizar' });
        return;
      }

      updates.push("updated_at = datetime('now')");
      await db.run(`UPDATE cost_centers SET ${updates.join(', ')} WHERE id = ?`, [...values, id]);

      const updated = await db.get('SELECT * FROM cost_centers WHERE id = ?', [id]);
      res.json({ data: updated });
    } catch (error) {
      logger.error('Error al actualizar centro de costo:', error);
      res.status(500).json({ error: 'Error al actualizar centro de costo' });
    }
  };

  getProjectCostCenters = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const projectId = Number(req.params.projectId);
      const project = await db.get(
        `SELECT p.id, p.name, p.currency, p.budget,
                pf.sale_price, pf.sale_price_currency
         FROM projects p
         LEFT JOIN project_financials pf ON pf.project_id = p.id
         WHERE p.id = ?`,
        [projectId]
      );

      if (!project) {
        res.status(404).json({ error: 'Proyecto no encontrado' });
        return;
      }

      // Check quote amount if approved or latest sent
      const quote = await db.get(
        `SELECT amount, currency FROM project_quotes
         WHERE project_id = ? AND status IN ('approved', 'sent')
         ORDER BY CASE WHEN status = 'approved' THEN 1 ELSE 2 END, version DESC
         LIMIT 1`,
        [projectId]
      );

      const allocations = await db.query(
        `SELECT pcca.*,
                cc.code AS cost_center_code,
                cc.name AS cost_center_name,
                cc.country,
                cc.category,
                cc.is_rpa
         FROM project_cost_center_allocations pcca
         JOIN cost_centers cc ON cc.id = pcca.cost_center_id
         WHERE pcca.project_id = ?
         ORDER BY cc.is_rpa DESC, pcca.amount DESC, pcca.id ASC`,
        [projectId]
      );

      const totalAllocated = allocations.reduce((sum: number, a: any) => sum + Number(a.amount || 0), 0);
      const expectedSalePrice = Number(quote?.amount ?? project.sale_price ?? project.budget ?? 0);
      const currency = quote?.currency || project.sale_price_currency || project.currency || 'CLP';
      const difference = Math.round((expectedSalePrice - totalAllocated) * 100) / 100;
      const isBalanced = expectedSalePrice > 0 ? Math.abs(difference) <= 0.01 : totalAllocated > 0;

      res.json({
        data: {
          project_id: projectId,
          project_name: project.name,
          currency,
          sale_price: expectedSalePrice,
          total_allocated: totalAllocated,
          difference,
          is_balanced: isBalanced,
          allocations
        }
      });
    } catch (error) {
      logger.error('Error al obtener centros de costos del proyecto:', error);
      res.status(500).json({ error: 'Error al obtener imputación de centros de costos' });
    }
  };

  setProjectCostCenters = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!canManage(req.user?.role)) {
        res.status(403).json({ error: 'No tienes permiso para modificar la imputación de centros de costos' });
        return;
      }

      const projectId = Number(req.params.projectId);
      const project = await db.get('SELECT id, name, currency FROM projects WHERE id = ?', [projectId]);
      if (!project) {
        res.status(404).json({ error: 'Proyecto no encontrado' });
        return;
      }

      const { allocations, quote_id } = req.body;
      if (!Array.isArray(allocations)) {
        res.status(400).json({ error: 'Se requiere una lista de asignaciones de centros de costos' });
        return;
      }

      // Validar cada asignación
      for (const item of allocations) {
        if (!item.cost_center_id || Number(item.amount) < 0) {
          res.status(400).json({ error: 'Cada asignación requiere un cost_center_id y un monto mayor o igual a 0' });
          return;
        }
        const ceco = await db.get('SELECT id FROM cost_centers WHERE id = ?', [item.cost_center_id]);
        if (!ceco) {
          res.status(400).json({ error: `Centro de costo con ID ${item.cost_center_id} no existe` });
          return;
        }
      }

      await db.beginTransaction();
      try {
        // Eliminar imputaciones previas del proyecto (o de la cotización específica si se envía)
        if (quote_id) {
          await db.run('DELETE FROM project_cost_center_allocations WHERE project_id = ? AND quote_id = ?', [projectId, quote_id]);
        } else {
          await db.run('DELETE FROM project_cost_center_allocations WHERE project_id = ?', [projectId]);
        }

        const currency = project.currency || 'CLP';
        const totalAmount = allocations.reduce((sum: number, a: any) => sum + Number(a.amount || 0), 0);

        for (const item of allocations) {
          const amount = Number(item.amount);
          const percentage = totalAmount > 0 ? (amount / totalAmount) * 100 : (item.percentage ?? null);

          await db.run(
            `INSERT INTO project_cost_center_allocations (
               project_id, quote_id, cost_center_id, amount, percentage, currency, description
             ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              projectId,
              quote_id ?? null,
              item.cost_center_id,
              amount,
              percentage !== null && percentage !== undefined ? Math.round(percentage * 100) / 100 : null,
              item.currency || currency,
              item.description?.trim() ?? null
            ]
          );
        }

        await db.commit();
      } catch (txError) {
        await db.rollback();
        throw txError;
      }

      await activityLogService.logActivity(
        req.user?.id,
        'project',
        projectId,
        'cost_centers_allocated',
        null,
        { allocations_count: allocations.length }
      );

      // Retornar la lista actualizada
      await this.getProjectCostCenters(req, res);
    } catch (error) {
      logger.error('Error al guardar imputación de centros de costos:', error);
      res.status(500).json({ error: 'Error al guardar imputación de centros de costos' });
    }
  };
}

export const costCenterController = new CostCenterController();
