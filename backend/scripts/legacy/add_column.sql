ALTER TABLE llm_api_keys ADD COLUMN selected_model VARCHAR(50);
SELECT * FROM pragma_table_info('llm_api_keys');
