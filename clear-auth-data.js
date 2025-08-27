// Script para limpiar completamente los datos de autenticación
// Ejecutar en la consola del navegador para resolver problemas de tokens expirados

console.log('🧹 Limpiando datos de autenticación...');

// Limpiar localStorage
localStorage.removeItem('rpa_token');
localStorage.removeItem('rpa_user');
localStorage.removeItem('rpa-auth-storage');

// Limpiar sessionStorage por si acaso
sessionStorage.removeItem('rpa_token');
sessionStorage.removeItem('rpa_user');
sessionStorage.removeItem('rpa-auth-storage');

// Limpiar cookies si las hay
document.cookie = 'rpa_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
document.cookie = 'rpa_user=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';

console.log('✅ Datos de autenticación limpiados. Recarga la página.');
console.log('🔄 Ejecuta: window.location.reload() para recargar la página');

// Recargar automáticamente la página
setTimeout(() => {
    window.location.reload();
}, 1000);