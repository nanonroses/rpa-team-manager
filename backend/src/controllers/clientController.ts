import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { db } from '../database/database';

const canManage = (role?: string) => role === 'team_lead' || role === 'rpa_operations';

export class ClientController {
  listClients = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const includeInactive = req.query.include_inactive === 'true';
    const clients = await db.query(`SELECT * FROM clients ${includeInactive ? '' : 'WHERE is_active = 1'} ORDER BY name`);
    const data = await Promise.all(clients.map(async (client: any) => ({
      ...client,
      contacts: await db.query(`SELECT * FROM client_contacts WHERE client_id = ? ${includeInactive ? '' : 'AND is_active = 1'} ORDER BY is_primary DESC, name`, [client.id])
    })));
    res.json({ data });
  };

  createClient = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!canManage(req.user?.role)) { res.status(403).json({ error: 'No tienes permiso para crear clientes' }); return; }
    const { name, tax_id, email, phone, address, notes, contact } = req.body;
    if (!String(name ?? '').trim()) { res.status(400).json({ error: 'El nombre del cliente es obligatorio' }); return; }
    const result = await db.run(`INSERT INTO clients (name, tax_id, email, phone, address, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`, [name.trim(), tax_id ?? null, email ?? null, phone ?? null, address ?? null, notes ?? null, req.user?.id ?? null]);
    if (contact?.name?.trim()) await db.run(`INSERT INTO client_contacts (client_id, name, position, email, phone, is_primary) VALUES (?, ?, ?, ?, ?, 1)`, [result.id, contact.name.trim(), contact.position ?? null, contact.email ?? null, contact.phone ?? null]);
    res.status(201).json({ data: await db.get('SELECT * FROM clients WHERE id = ?', [result.id]) });
  };

  updateClient = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!canManage(req.user?.role)) { res.status(403).json({ error: 'No tienes permiso para editar clientes' }); return; }
    const fields = ['name', 'tax_id', 'email', 'phone', 'address', 'notes', 'is_active'];
    const updates = fields.filter((key) => req.body[key] !== undefined);
    if (!updates.length) { res.status(400).json({ error: 'No hay campos para actualizar' }); return; }
    await db.run(`UPDATE clients SET ${updates.map((key) => `${key} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`, [...updates.map((key) => req.body[key]), Number(req.params.clientId)]);
    res.json({ data: await db.get('SELECT * FROM clients WHERE id = ?', [Number(req.params.clientId)]) });
  };

  addContact = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!canManage(req.user?.role)) { res.status(403).json({ error: 'No tienes permiso para editar contactos' }); return; }
    const clientId = Number(req.params.clientId);
    const { name, position, email, phone, is_primary = false } = req.body;
    if (!String(name ?? '').trim()) { res.status(400).json({ error: 'El nombre del contacto es obligatorio' }); return; }
    await db.beginTransaction();
    try {
      if (is_primary) await db.run('UPDATE client_contacts SET is_primary = 0 WHERE client_id = ?', [clientId]);
      const result = await db.run(`INSERT INTO client_contacts (client_id, name, position, email, phone, is_primary) VALUES (?, ?, ?, ?, ?, ?)`, [clientId, name.trim(), position ?? null, email ?? null, phone ?? null, is_primary ? 1 : 0]);
      await db.commit();
      res.status(201).json({ data: await db.get('SELECT * FROM client_contacts WHERE id = ?', [result.id]) });
    } catch (error) { await db.rollback(); throw error; }
  };

  updateContact = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!canManage(req.user?.role)) { res.status(403).json({ error: 'No tienes permiso para editar contactos' }); return; }
    const contactId = Number(req.params.contactId);
    const current = await db.get('SELECT * FROM client_contacts WHERE id = ?', [contactId]);
    if (!current) { res.status(404).json({ error: 'Contacto no encontrado' }); return; }
    const fields = ['name', 'position', 'email', 'phone', 'is_primary', 'is_active'];
    const updates = fields.filter((key) => req.body[key] !== undefined);
    await db.beginTransaction();
    try {
      if (req.body.is_primary) await db.run('UPDATE client_contacts SET is_primary = 0 WHERE client_id = ?', [current.client_id]);
      if (updates.length) await db.run(`UPDATE client_contacts SET ${updates.map((key) => `${key} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`, [...updates.map((key) => key === 'is_primary' || key === 'is_active' ? Number(Boolean(req.body[key])) : req.body[key]), contactId]);
      await db.commit();
      res.json({ data: await db.get('SELECT * FROM client_contacts WHERE id = ?', [contactId]) });
    } catch (error) { await db.rollback(); throw error; }
  };

  listSalesReps = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    const salesReps = await db.query(`SELECT * FROM sales_reps WHERE is_active = 1 ORDER BY name`);
    res.json({ data: salesReps });
  };

  createSalesRep = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!canManage(req.user?.role)) { res.status(403).json({ error: 'No tienes permiso para crear comerciales' }); return; }
    const { name, email } = req.body;
    if (!String(name ?? '').trim()) { res.status(400).json({ error: 'El nombre del comercial es obligatorio' }); return; }
    const result = await db.run('INSERT INTO sales_reps (name, email, created_by) VALUES (?, ?, ?)', [name.trim(), email ?? null, req.user?.id ?? null]);
    res.status(201).json({ data: await db.get('SELECT * FROM sales_reps WHERE id = ?', [result.id]) });
  };

  updateSalesRep = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!canManage(req.user?.role)) { res.status(403).json({ error: 'No tienes permiso para editar comerciales' }); return; }
    const fields = ['name', 'email', 'is_active'];
    const updates = fields.filter((key) => req.body[key] !== undefined);
    if (!updates.length) { res.status(400).json({ error: 'No hay campos para actualizar' }); return; }
    await db.run(`UPDATE sales_reps SET ${updates.map((key) => `${key} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`, [...updates.map((key) => key === 'is_active' ? Number(Boolean(req.body[key])) : req.body[key]), Number(req.params.salesRepId)]);
    res.json({ data: await db.get('SELECT * FROM sales_reps WHERE id = ?', [Number(req.params.salesRepId)]) });
  };
}

export const clientController = new ClientController();
