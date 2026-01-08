# Tests Fixtures

Datos de prueba utilizados por los tests.

## Usuarios de Test

```json
[
  {
    "id": 1,
    "email": "admin@rpa.com",
    "password": "admin123",
    "role": "team_lead",
    "full_name": "Admin User"
  },
  {
    "id": 2,
    "email": "dev1@rpa.com",
    "password": "dev123",
    "role": "rpa_developer",
    "full_name": "Developer One"
  },
  {
    "id": 3,
    "email": "ops1@rpa.com",
    "password": "ops123",
    "role": "rpa_operations",
    "full_name": "Operations One"
  }
]
```

## Proyectos de Test

```json
[
  {
    "id": 1,
    "name": "Test Project Alpha",
    "status": "active",
    "budget": 5000000,
    "budgeted_hours": 100
  },
  {
    "id": 2,
    "name": "Test Project Beta",
    "status": "completed",
    "budget": 3000000,
    "budgeted_hours": 60
  }
]
```

## Asignaciones de Test

```json
[
  {
    "project_id": 1,
    "user_id": 1,
    "role": "lead",
    "allocation_percentage": 50
  },
  {
    "project_id": 1,
    "user_id": 2,
    "role": "contributor",
    "allocation_percentage": 100
  }
]
```

## Datos Financieros de Test

```json
{
  "monthlySalaries": {
    "team_lead": 2500000,
    "rpa_developer": 2000000,
    "rpa_operations": 1800000,
    "it_support": 1500000
  },
  "monthlyHours": 176,
  "exchangeRates": {
    "usd": 925.50,
    "uf": 37250.85
  }
}
```
