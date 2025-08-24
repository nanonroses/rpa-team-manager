# ProjectPMOView Component Documentation

## Overview

The `ProjectPMOView` component is a comprehensive React component that displays Project Management Office (PMO) analytics and metrics for individual projects. It provides real-time project health monitoring, milestone tracking, performance indicators, and actionable insights for project managers.

## Location
- **File**: `frontend/src/components/projects/ProjectPMOView.tsx`
- **Export**: Named export `ProjectPMOView`

## Component Features

### Core Functionality
- **Real-time PMO Metrics**: Displays completion percentage, schedule variance, budget status, and quality scores
- **Risk Assessment**: Visual risk level indicators with color-coded alerts
- **Milestone Timeline**: Interactive milestone tracking with status indicators
- **Performance Dashboard**: Team velocity, resource utilization, and productivity metrics
- **Error Handling**: Comprehensive error states with retry mechanisms
- **Responsive Design**: Adaptive layout for different screen sizes

### Enhanced Features
- **Multi-currency Support**: Handles budget display in different currencies
- **Fallback Data Loading**: Attempts to load Gantt data when PMO metrics fail
- **Contextual Insights**: Automatic recommendations based on project status
- **Progress Visualization**: Dynamic progress bars and completion indicators

## Props Interface

```typescript
interface ProjectPMOViewProps {
  projectId: number;           // Required: Project identifier
  projectName: string;         // Required: Project display name
  projectStatus?: string;      // Optional: Current project status
  startDate?: string;          // Optional: Project start date
  endDate?: string;           // Optional: Project end date
}
```

## Usage Examples

### Basic Usage
```tsx
import { ProjectPMOView } from '@/components/projects/ProjectPMOView';

// In a project detail page
<ProjectPMOView 
  projectId={1} 
  projectName="Project Alpha"
/>
```

### Complete Usage
```tsx
<ProjectPMOView 
  projectId={1} 
  projectName="Project Alpha"
  projectStatus="active"
  startDate="2024-07-01"
  endDate="2024-09-30"
/>
```

### Integration in Project Detail Page
```tsx
// In ProjectDetailPage.tsx
const ProjectDetailPage: React.FC = () => {
  const { id } = useParams();
  const [project, setProject] = useState<Project | null>(null);

  return (
    <div>
      <h1>{project?.name}</h1>
      
      {/* PMO Analytics Section */}
      <Card title="PMO Analytics">
        <ProjectPMOView 
          projectId={parseInt(id!)} 
          projectName={project?.name || 'Loading...'}
          projectStatus={project?.status}
          startDate={project?.start_date}
          endDate={project?.end_date}
        />
      </Card>
    </div>
  );
};
```

## Component Structure

### State Management
```typescript
// Core state
const [loading, setLoading] = useState(true);
const [pmoMetrics, setPmoMetrics] = useState<PMOMetrics | null>(null);
const [milestones, setMilestones] = useState<Milestone[]>([]);
const [ganttData] = useState<any>(null); // Reserved for future use

// Error handling
const [error, setError] = useState<ErrorState>({
  hasError: false,
  errorMessage: '',
  errorType: 'unknown'
});

// Retry mechanism
const [retryCount, setRetryCount] = useState(0);
```

### Data Interfaces
```typescript
interface PMOMetrics {
  completion_percentage: number;
  schedule_variance_days: number;
  cost_variance_percentage: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  team_velocity: number;
  bugs_found: number;
  bugs_resolved: number;
  actual_hours: number;
  planned_hours: number;
}

interface Milestone {
  id: number;
  name: string;
  description: string;
  milestone_type: string;
  planned_date: string;
  actual_date: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed' | 'cancelled';
  priority: 'critical' | 'high' | 'medium' | 'low';
  completion_percentage: number;
  responsibility: 'internal' | 'client' | 'external' | 'shared';
  delay_justification?: string;
  financial_impact?: number;
}

interface ErrorState {
  hasError: boolean;
  errorMessage: string;
  errorType: 'network' | 'permission' | 'data' | 'unknown';
}
```

## Component Layout

### Two-Column Layout
The component uses a responsive two-column layout:

#### Left Column (Primary Content)
- **Performance Metrics Card**: Key project indicators
- **Quality Metrics Card**: Bug tracking and resolution rates
- **Hours Tracking**: Time management and progress

#### Right Column (Secondary Content)
- **Milestones Card**: Timeline and delivery tracking
- **PMO Insights Card**: Automated alerts and recommendations

### Responsive Behavior
- **Desktop**: Two-column layout (14/10 split)
- **Tablet**: Stacked layout
- **Mobile**: Single column with optimized spacing

## Visual Elements

### Status Indicators
```typescript
// Risk level colors
const getRiskColor = (riskLevel: string) => ({
  low: '#52c41a',      // Green
  medium: '#faad14',   // Yellow
  high: '#fa8c16',     // Orange
  critical: '#ff4d4f'  // Red
});

// Milestone status colors
const getMilestoneStatusColor = (status: string) => ({
  pending: 'default',
  in_progress: 'processing',
  completed: 'success',
  delayed: 'error',
  cancelled: 'error'
});

// Responsibility colors
const getResponsibilityColor = (responsibility: string) => ({
  internal: 'blue',
  client: 'orange',
  external: 'purple',
  shared: 'cyan'
});
```

### Progress Indicators
- **Completion Progress**: Circular progress with color coding
- **Schedule Status**: Visual indicators for ahead/behind schedule
- **Budget Status**: Color-coded budget variance display
- **Quality Score**: Dynamic scoring based on bug resolution rate

## Error Handling

### Error Types
The component handles four types of errors:

1. **Network Errors**: Connection issues, timeouts
2. **Permission Errors**: Access denied, insufficient permissions
3. **Data Errors**: Invalid responses, missing data
4. **Unknown Errors**: Unexpected errors

### Error States
```typescript
// Network error example
{
  hasError: true,
  errorMessage: 'Network error. Please check your connection and try again.',
  errorType: 'network'
}

// Permission error example  
{
  hasError: true,
  errorMessage: 'Access denied. You may not have permission to view this project\'s PMO data.',
  errorType: 'permission'
}
```

### Retry Mechanism
- **Automatic Retry**: Up to 2 retries for non-permission errors
- **Fallback Data**: Attempts to load Gantt data when PMO data fails
- **User-Initiated Retry**: Manual retry button with retry count tracking

## Data Loading Strategy

### Primary Data Source
```typescript
const loadPMOData = async () => {
  try {
    // Load comprehensive PMO metrics
    const pmoData = await apiService.getProjectPMOMetrics(projectId);
    
    if (pmoData && pmoData.project) {
      setPmoMetrics({
        completion_percentage: pmoData.project.completion_percentage || 0,
        schedule_variance_days: pmoData.project.schedule_variance_days || 0,
        cost_variance_percentage: pmoData.project.cost_variance_percentage || 0,
        risk_level: pmoData.project.risk_level || 'low',
        team_velocity: pmoData.project.team_velocity || 0,
        bugs_found: pmoData.project.bugs_found || 0,
        bugs_resolved: pmoData.project.bugs_resolved || 0,
        actual_hours: pmoData.project.actual_hours || 0,
        planned_hours: pmoData.project.planned_hours || 0
      });
      
      if (pmoData.milestones?.list) {
        setMilestones(pmoData.milestones.list);
      }
    }
  } catch (error) {
    handleError(error);
  }
};
```

### Fallback Strategy
```typescript
// Fallback: Try to load basic milestone data via Gantt API
if (errorState.errorType !== 'permission' && retryCount < 2) {
  try {
    const ganttResponse = await apiService.getProjectGantt(projectId);
    if (ganttResponse?.milestones) {
      setMilestones(ganttResponse.milestones);
      message.info('Loaded basic milestone data as fallback');
    }
  } catch (ganttError) {
    console.error('Error loading fallback Gantt data:', ganttError);
  }
}
```

## Metrics Calculations

### Quality Score Calculation
```typescript
const qualityScore = pmoMetrics?.bugs_found ? 
  Math.max(0, 100 - ((pmoMetrics.bugs_found - (pmoMetrics.bugs_resolved || 0)) * 10)) : 100;
```

### Schedule Status Determination
```typescript
const scheduleStatus = pmoMetrics?.schedule_variance_days || 0;
// Positive = ahead of schedule, Negative = behind schedule
```

### Budget Performance
```typescript
const costStatus = pmoMetrics?.cost_variance_percentage || 0;
// Positive = over budget, Negative = under budget
```

### Hours Progress
```typescript
const hoursProgress = pmoMetrics?.planned_hours > 0 ? 
  Math.round((pmoMetrics.actual_hours / pmoMetrics.planned_hours) * 100) : 0;
```

## Automated Insights

### Critical Risk Detection
```typescript
{pmoMetrics?.risk_level === 'critical' && (
  <Alert
    message="Critical Risk Detected"
    description="This project requires immediate attention from PMO."
    type="error"
    showIcon
    icon={<FireOutlined />}
  />
)}
```

### Schedule Delay Alerts
```typescript
{scheduleStatus < -7 && (
  <Alert
    message="Schedule Delay"
    description={`Project is ${Math.abs(scheduleStatus)} days behind schedule.`}
    type="warning"
    showIcon
  />
)}
```

### Budget Overrun Warnings
```typescript
{costStatus > 20 && (
  <Alert
    message="Budget Overrun"
    description={`Project is ${costStatus}% over budget.`}
    type="error"
    showIcon
  />
)}
```

### Setup Recommendations
```typescript
{(!pmoMetrics || (pmoMetrics.completion_percentage < 10 && milestones.length === 0)) && (
  <Alert
    message="PMO Setup Required"
    description="Set up project milestones and metrics for better tracking."
    type="info"
    showIcon
    action={
      <Button size="small" onClick={handleViewFullPMO}>
        Setup PMO
      </Button>
    }
  />
)}
```

## Navigation Integration

### PMO Dashboard Navigation
```typescript
const handleViewFullPMO = () => {
  navigate(`/pmo?project=${projectId}`);
};
```

### Gantt Chart Navigation
```typescript
const handleViewGantt = () => {
  navigate(`/pmo/gantt/${projectId}`);
};
```

## Performance Optimizations

### Efficient Re-renders
- Uses `useState` and `useEffect` strategically
- Prevents unnecessary API calls with dependency arrays
- Implements loading states to prevent multiple concurrent requests

### Error Boundary Integration
- Graceful error handling without component crashes
- Fallback UI for error states
- Recovery mechanisms with retry functionality

### Memory Management
- Proper cleanup in `useEffect`
- Avoids memory leaks with proper state management
- Efficient data structure usage

## Styling and Theming

### Ant Design Integration
The component uses Ant Design components with consistent theming:

```tsx
// Color consistency
valueStyle={{ 
  color: pmoMetrics.completion_percentage > 75 ? '#52c41a' : 
         pmoMetrics.completion_percentage > 50 ? '#faad14' : '#ff4d4f' 
}}

// Responsive spacing
style={{ padding: '8px 0' }}
gutter={[24, 24]} // Responsive gutters
```

### Custom Styling
- Responsive breakpoints
- Consistent spacing and typography
- Color-coded status indicators
- Professional layout with proper hierarchy

## Testing Considerations

### Unit Testing
```typescript
// Test data loading
describe('ProjectPMOView Data Loading', () => {
  test('loads PMO metrics successfully', async () => {
    // Mock API response
    const mockData = {
      project: {
        completion_percentage: 75,
        risk_level: 'medium'
      }
    };
    
    jest.spyOn(apiService, 'getProjectPMOMetrics').mockResolvedValue(mockData);
    
    render(<ProjectPMOView projectId={1} projectName="Test Project" />);
    
    await waitFor(() => {
      expect(screen.getByText('75%')).toBeInTheDocument();
    });
  });
});
```

### Error State Testing
```typescript
// Test error handling
test('handles network errors gracefully', async () => {
  jest.spyOn(apiService, 'getProjectPMOMetrics').mockRejectedValue(new Error('Network error'));
  
  render(<ProjectPMOView projectId={1} projectName="Test Project" />);
  
  await waitFor(() => {
    expect(screen.getByText(/network error/i)).toBeInTheDocument();
  });
});
```

### Integration Testing
- Test with different project states
- Verify navigation functionality
- Test responsive behavior
- Validate error recovery flows

## Accessibility

### Screen Reader Support
- Proper ARIA labels on statistics
- Descriptive alt text for icons
- Semantic HTML structure

### Keyboard Navigation
- Focusable interactive elements
- Tab order optimization
- Keyboard shortcuts support

### Color Accessibility
- High contrast color schemes
- Color-blind friendly indicators
- Alternative text indicators

## Future Enhancements

### Planned Features
1. **Real-time Updates**: WebSocket integration for live data
2. **Gantt Integration**: Full Gantt chart embedding
3. **Export Functionality**: PDF/Excel export of metrics
4. **Customizable Dashboard**: User-configurable metrics display

### API Integration Improvements
1. **Caching Strategy**: Implement intelligent data caching
2. **Offline Support**: Basic offline functionality
3. **Performance Metrics**: Component performance monitoring

## Dependencies

### Required Packages
```json
{
  "react": "^18.0.0",
  "react-router-dom": "^6.0.0",
  "antd": "^5.0.0",
  "@ant-design/icons": "^5.0.0",
  "dayjs": "^1.11.0"
}
```

### Internal Dependencies
- `@/services/api`: API service layer
- `@/utils/colorMappings`: Color utility functions (if available)

## Browser Support

- **Chrome**: 90+
- **Firefox**: 85+
- **Safari**: 14+
- **Edge**: 90+

The component uses modern React features but maintains broad browser compatibility through proper transpilation and polyfills.

## Conclusion

The `ProjectPMOView` component provides a comprehensive, user-friendly interface for project management analytics. Its robust error handling, responsive design, and intuitive layout make it an essential tool for project managers to monitor project health, track milestones, and make data-driven decisions.

The component successfully bridges the gap between complex PMO data and actionable insights, providing both high-level overviews and detailed metrics in a single, cohesive interface.