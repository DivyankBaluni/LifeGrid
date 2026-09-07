import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '../models/types.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'lifegrid-sih26133-secure-key';

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: UserRole;
  facility_id: string | null;
  language_pref: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export type PermissionAction =
  | 'incident:create'
  | 'incident:view'
  | 'patient:view_phi'
  | 'triage:override'
  | 'referral:create'
  | 'referral:update'
  | 'facility:edit_capacity'
  | 'dashboard:view'
  | 'audit:view';

const ROLE_PERMISSIONS: Record<UserRole, Set<PermissionAction>> = {
  citizen: new Set(['incident:create', 'incident:view']),
  health_worker: new Set([
    'incident:create',
    'incident:view',
    'patient:view_phi',
    'triage:override',
    'referral:create',
    'referral:update',
  ]),
  ambulance_crew: new Set(['incident:view']),
  hospital_staff: new Set([
    'incident:view',
    'patient:view_phi',
    'triage:override',
    'referral:create',
    'referral:update',
    'facility:edit_capacity',
  ]),
  specialist: new Set(['incident:view', 'patient:view_phi', 'referral:update']),
  control_center_operator: new Set([
    'incident:create',
    'incident:view',
    'patient:view_phi',
    'triage:override',
    'referral:create',
    'referral:update',
    'dashboard:view',
    'audit:view',
  ]),
  admin: new Set([
    'incident:create',
    'incident:view',
    'patient:view_phi',
    'triage:override',
    'referral:create',
    'referral:update',
    'facility:edit_capacity',
    'dashboard:view',
    'audit:view',
  ]),
};

export function hasPermission(role: UserRole, action: PermissionAction): boolean {
  const perms = ROLE_PERMISSIONS[role];
  return perms ? perms.has(action) : false;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Provide a default fallback demo user if no token (e.g. control_center_operator for demo ease, or prompt 401)
    const demoRole = (req.headers['x-demo-role'] as UserRole) || 'control_center_operator';
    req.user = {
      id: 'demo-user-id',
      username: 'demo_operator',
      role: demoRole,
      facility_id: null,
      language_pref: 'en',
    };
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requirePermission(action: PermissionAction) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!hasPermission(req.user.role, action)) {
      return res.status(403).json({
        error: `Role '${req.user.role}' lacks permission for action '${action}'`,
      });
    }
    next();
  };
}
