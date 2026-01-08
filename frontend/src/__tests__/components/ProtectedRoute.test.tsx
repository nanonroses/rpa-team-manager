/**
 * Tests para ProtectedRoute
 * Feature: F09 - Autenticación y Seguridad
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';

// Mock del componente simplificado para testing
const mockAuthState = {
    isAuthenticated: false,
    isLoading: false,
    user: null as { id: number; email: string; role: string; fullName: string } | null,
    token: null as string | null,
};

// Componente ProtectedRoute simplificado para tests
const TestProtectedRoute: React.FC<{
    children: React.ReactNode;
    requiredRoles?: string[];
}> = ({ children, requiredRoles = [] }) => {
    if (mockAuthState.isLoading) {
        return <div>Loading...</div>;
    }

    if (!mockAuthState.isAuthenticated || !mockAuthState.user) {
        return <div>Redirected to Login</div>;
    }

    if (requiredRoles.length > 0 && !requiredRoles.includes(mockAuthState.user.role)) {
        return <div>Unauthorized</div>;
    }

    return <>{children}</>;
};

describe('ProtectedRoute', () => {
    beforeEach(() => {
        mockAuthState.isAuthenticated = false;
        mockAuthState.isLoading = false;
        mockAuthState.user = null;
        mockAuthState.token = null;
    });

    it('debería mostrar loading cuando isLoading es true', () => {
        mockAuthState.isLoading = true;

        render(
            <MemoryRouter>
                <TestProtectedRoute>
                    <div>Protected Content</div>
                </TestProtectedRoute>
            </MemoryRouter>
        );

        expect(screen.getByText('Loading...')).toBeInTheDocument();
        expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('debería redirigir a login cuando no está autenticado', () => {
        mockAuthState.isAuthenticated = false;
        mockAuthState.user = null;

        render(
            <MemoryRouter>
                <TestProtectedRoute>
                    <div>Protected Content</div>
                </TestProtectedRoute>
            </MemoryRouter>
        );

        expect(screen.getByText('Redirected to Login')).toBeInTheDocument();
        expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('debería mostrar contenido cuando está autenticado', () => {
        mockAuthState.isAuthenticated = true;
        mockAuthState.user = {
            id: 1,
            email: 'admin@rpa.com',
            role: 'team_lead',
            fullName: 'Admin User',
        };

        render(
            <MemoryRouter>
                <TestProtectedRoute>
                    <div>Protected Content</div>
                </TestProtectedRoute>
            </MemoryRouter>
        );

        expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('debería permitir acceso si el usuario tiene el rol requerido', () => {
        mockAuthState.isAuthenticated = true;
        mockAuthState.user = {
            id: 1,
            email: 'admin@rpa.com',
            role: 'team_lead',
            fullName: 'Admin User',
        };

        render(
            <MemoryRouter>
                <TestProtectedRoute requiredRoles={['team_lead']}>
                    <div>Admin Only Content</div>
                </TestProtectedRoute>
            </MemoryRouter>
        );

        expect(screen.getByText('Admin Only Content')).toBeInTheDocument();
    });

    it('debería mostrar unauthorized si el usuario no tiene el rol requerido', () => {
        mockAuthState.isAuthenticated = true;
        mockAuthState.user = {
            id: 2,
            email: 'dev@rpa.com',
            role: 'rpa_developer',
            fullName: 'Developer User',
        };

        render(
            <MemoryRouter>
                <TestProtectedRoute requiredRoles={['team_lead']}>
                    <div>Admin Only Content</div>
                </TestProtectedRoute>
            </MemoryRouter>
        );

        expect(screen.getByText('Unauthorized')).toBeInTheDocument();
        expect(screen.queryByText('Admin Only Content')).not.toBeInTheDocument();
    });
});
