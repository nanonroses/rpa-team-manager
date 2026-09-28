// API identifiers stay unchanged; only their presentation is localized.
const labels: Record<string, string> = {
  pending: 'Pendiente', planned: 'Planificado', planning: 'Planificación', active: 'Activo',
  in_progress: 'En curso', completed: 'Completado', done: 'Completado', todo: 'Pendiente',
  blocked: 'Bloqueado', skipped: 'Omitido', cancelled: 'Cancelado', delayed: 'Retrasado',
  on_hold: 'En pausa', review: 'En revisión', testing: 'En pruebas', under_review: 'En revisión',
  draft: 'Borrador', approved: 'Aprobado', rejected: 'Rechazado', sent: 'Enviado',
  billable: 'Por facturar', invoiced: 'Facturado', issued: 'Emitida', paid: 'Pagado',
  overdue: 'Vencido', partial: 'Pago parcial', partially_paid: 'Pago parcial', void: 'Anulada',
  low: 'Bajo', medium: 'Medio', high: 'Alto', critical: 'Crítico', urgent: 'Urgente',
  internal: 'Interno', external: 'Externo', client: 'Cliente', shared: 'Compartido',
  lead: 'Líder', member: 'Miembro',
  attachment: 'Adjunto', evidence: 'Evidencia', documentation: 'Documentación',
  screenshot: 'Captura de pantalla', diagram: 'Diagrama', report: 'Informe',
  presentation: 'Presentación', code: 'Código', config: 'Configuración', log: 'Registro', other: 'Otro',
  documents: 'Documentos', images: 'Imágenes', presentations: 'Presentaciones',
  spreadsheets: 'Hojas de cálculo', archives: 'Archivos comprimidos', videos: 'Videos', audio: 'Audio',
  doc_pdd: 'PDD', doc_technical: 'Documentación técnica', doc_contract: 'Contrato/OC', doc_other: 'Otro',
  automation: 'Automatización', process_improvement: 'Mejora de procesos', tool_enhancement: 'Mejora de herramientas',
  cost_reduction: 'Reducción de costos', productivity: 'Productividad', general: 'General',
};
export const displayLabel = (value?: string | null): string => value ? labels[value.toLowerCase()] || value : 'Sin información';
