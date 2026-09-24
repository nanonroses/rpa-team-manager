import React, { useRef, useState } from 'react';
import { AutoComplete, Input, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiService } from '@/services/api';

const { Text } = Typography;

interface SearchOption {
  value: string;
  label: React.ReactNode;
  taskId: number;
}

export const GlobalSearch: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<SearchOption[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = async (value: string) => {
    if (value.trim().length < 2) {
      setOptions([]);
      return;
    }

    try {
      const tasks = await apiService.searchTasks(value.trim());
      setOptions(
        (tasks || []).map((task: any) => ({
          value: String(task.id),
          taskId: task.id,
          label: (
            <div>
              <div>{task.title}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {task.project_name}
                {task.board_name ? ` · ${task.board_name}` : ''}
              </Text>
            </div>
          )
        }))
      );
    } catch (error) {
      console.error('Error buscando tareas:', error);
      setOptions([]);
    }
  };

  const handleChange = (value: string) => {
    setQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => runSearch(value), 300);
  };

  const handleSelect = (_value: string, option: SearchOption) => {
    setQuery('');
    setOptions([]);
    navigate(`/tasks?taskId=${option.taskId}`);
  };

  return (
    <AutoComplete
      value={query}
      options={options}
      onChange={handleChange}
      onSelect={handleSelect as any}
      style={{ width: 280 }}
      notFoundContent={query.trim().length >= 2 ? 'Sin resultados' : null}
    >
      <Input aria-label="Buscar tareas" placeholder="Buscar tareas..." prefix={<SearchOutlined />} allowClear />
    </AutoComplete>
  );
};
