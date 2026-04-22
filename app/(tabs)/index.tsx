import DateTimePicker from '@react-native-community/datetimepicker';
import * as SQLite from 'expo-sqlite';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View
} from 'react-native';

const db = SQLite.openDatabaseSync('tasks.db');
const DEBUG_DB = __DEV__;

interface Task {
  id: string;
  text: string;
  completed: boolean;
  dueDate: string | null;
  category: string; // <-- NEW: Tasks now belong to a category
}

// Our preset lists, just like the Microsoft To Do image
const CATEGORIES = [
  { id: 'All', icon: '📋', name: 'All Tasks' },
  { id: 'Work', icon: '💼', name: 'Work' },
  { id: 'Groceries', icon: '🍉', name: 'Groceries' },
  { id: 'Home', icon: '🏠', name: 'Home' },
];

export default function HomeScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [inputText, setInputText] = useState('');
  
  // Scheduling State
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [hasDate, setHasDate] = useState(false); 

 
  const [activeCategory, setActiveCategory] = useState('All');

  const isDark = useColorScheme() === 'dark';

  const loadTasks = useCallback(() => {
    let query = 'SELECT * FROM tasks_v3 ORDER BY id DESC';
    let params: any[] = [];

    
    if (activeCategory !== 'All') {
      query = 'SELECT * FROM tasks_v3 WHERE category = ? ORDER BY id DESC';
      params = [activeCategory];
    }

    const allRows: any[] = db.getAllSync(query, params);

    if (DEBUG_DB) {
      const now = new Date().toISOString();
      const unfilteredRows: any[] =
        activeCategory === 'All' ? allRows : db.getAllSync('SELECT * FROM tasks_v3 ORDER BY id DESC');
      console.log(`[DB ${now}] query=${query} params=${JSON.stringify(params)}`);
      console.log('[DB] visible rows:', JSON.stringify(allRows, null, 2));
      console.log('[DB] all rows:', JSON.stringify(unfilteredRows, null, 2));
    }
    
    const formattedTasks = allRows.map(row => ({
      id: row.id,
      text: row.text,
      completed: row.completed === 1,
      dueDate: row.dueDate,
      category: row.category
    }));
    
    setTasks(formattedTasks);
  }, [activeCategory]);

  useEffect(() => {
    
    db.execSync(`
      CREATE TABLE IF NOT EXISTS tasks_v3 (
        id TEXT PRIMARY KEY NOT NULL,
        text TEXT NOT NULL,
        completed INTEGER NOT NULL,
        dueDate TEXT,
        category TEXT NOT NULL
      );
    `);
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const addTask = () => {
    if (inputText.trim().length === 0) return;
    
    const newId = Date.now().toString();
    const newText = inputText.trim();
    const taskDate = hasDate ? date.toISOString() : null;
    // If you add a task while viewing "All", default it to "Work". Otherwise, use the active tab.
    const taskCategory = activeCategory === 'All' ? 'Work' : activeCategory;

    db.runSync(
      'INSERT INTO tasks_v3 (id, text, completed, dueDate, category) VALUES (?, ?, ?, ?, ?)', 
      newId, newText, 0, taskDate, taskCategory
    );
    
    loadTasks();
    setInputText('');
    setHasDate(false);
    setDate(new Date());
  };

  const toggleTask = (id: string, currentCompleted: boolean) => {
    const newStatus = currentCompleted ? 0 : 1;
    db.runSync('UPDATE tasks_v3 SET completed = ? WHERE id = ?', newStatus, id);
    loadTasks();
  };

  const deleteTask = (id: string) => {
    db.runSync('DELETE FROM tasks_v3 WHERE id = ?', id);
    loadTasks();
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selectedDate) {
      setDate(selectedDate);
      setHasDate(true);
    }
  };

  const formatSchedule = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  };

  const activeCategoryData = CATEGORIES.find(c => c.id === activeCategory);
  const headerDateString = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());

  const renderItem = ({ item }: { item: Task }) => (
    <View style={[styles.taskCard, isDark ? styles.cardDark : styles.cardLight]}>
      <View style={styles.taskLeft}>
        <TouchableOpacity 
          style={[styles.checkbox, item.completed && styles.checkboxCompleted, isDark && !item.completed && styles.checkboxDark]} 
          onPress={() => toggleTask(item.id, item.completed)}
        >
          {item.completed && <Text style={styles.checkmark}>✓</Text>}
        </TouchableOpacity>
        
        <View style={styles.textContainer}>
          <Text style={[styles.taskText, isDark ? styles.textDark : styles.textLight, item.completed && styles.taskTextCompleted]}>
            {item.text}
          </Text>
          
          {/* Shows a tiny category pill next to the date if you are viewing "All Tasks" */}
          <View style={styles.metadataRow}>
            {activeCategory === 'All' && (
              <Text style={styles.categoryPill}>
                {CATEGORIES.find(c => c.id === item.category)?.icon} {item.category}
              </Text>
            )}
            {item.dueDate && (
              <Text style={styles.scheduleText}>📅 {formatSchedule(item.dueDate)}</Text>
            )}
          </View>
        </View>

      </View>
      <TouchableOpacity onPress={() => deleteTask(item.id)}>
        <Text style={styles.deleteText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, isDark ? styles.bgDark : styles.bgLight]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        
        {/* NEW: Category Selector Row */}
        <View style={styles.categoryRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity 
                key={cat.id} 
                style={[styles.categoryTab, activeCategory === cat.id && styles.categoryTabActive]}
                onPress={() => setActiveCategory(cat.id)}
              >
                <Text style={[styles.categoryTabText, activeCategory === cat.id && styles.categoryTabTextActive]}>
                  {cat.icon} {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.header}>
          {/* Dynamic Header changes based on selected category */}
          <Text style={[styles.title, isDark ? styles.textDark : styles.textLight]}>
            {activeCategoryData?.icon} {activeCategoryData?.name}
          </Text>
          <Text style={styles.dateText}>{headerDateString}</Text>
        </View>

        <View style={styles.inputWrapper}>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
              placeholder={`Add task to ${activeCategoryData?.name}...`}
              placeholderTextColor="#8E8E93"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={addTask}
            />
            <TouchableOpacity style={styles.addButton} onPress={addTask}>
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.scheduleControls}>
            <TouchableOpacity 
              style={[styles.scheduleButton, hasDate && styles.scheduleButtonActive]} 
              onPress={() => setShowPicker(true)}
            >
              <Text style={[styles.scheduleButtonText, hasDate && styles.scheduleButtonTextActive]}>
                {hasDate ? `🕒 ${formatSchedule(date.toISOString())}` : '🕒 Set Schedule'}
              </Text>
            </TouchableOpacity>
            {hasDate && (
              <TouchableOpacity onPress={() => setHasDate(false)} style={{marginLeft: 10, padding: 5}}>
                <Text style={{color: '#FF3B30'}}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {showPicker && (
            <DateTimePicker value={date} mode="datetime" display="default" onChange={onDateChange} />
          )}
        </View>

        {tasks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No tasks in {activeCategoryData?.name}</Text>
          </View>
        ) : (
          <FlatList
            data={tasks}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  bgLight: { backgroundColor: '#F2F2F7' },
  bgDark: { backgroundColor: '#000000' },
  textLight: { color: '#1C1C1E' },
  textDark: { color: '#FFFFFF' },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },

  categoryRow: { marginBottom: 15, marginHorizontal: -20 },
  categoryScroll: { paddingHorizontal: 20, gap: 10 },
  categoryTab: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#E5E5EA', borderRadius: 20 },
  categoryTabActive: { backgroundColor: '#007AFF' },
  categoryTabText: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  categoryTabTextActive: { color: '#FFFFFF' },

  header: { marginBottom: 20 },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  dateText: { marginTop: 6, fontSize: 14, color: '#8E8E93', fontWeight: '600' },

  inputWrapper: { marginBottom: 12 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, borderWidth: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, fontSize: 16 },
  inputLight: { backgroundColor: '#FFFFFF', borderColor: '#D1D1D6', color: '#1C1C1E' },
  inputDark: { backgroundColor: '#1C1C1E', borderColor: '#2C2C2E', color: '#FFFFFF' },
  addButton: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, backgroundColor: '#34C759' },
  addButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  scheduleControls: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  scheduleButton: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#E5E5EA' },
  scheduleButtonActive: { backgroundColor: '#007AFF' },
  scheduleButtonText: { fontSize: 14, color: '#1C1C1E', fontWeight: '600' },
  scheduleButtonTextActive: { color: '#FFFFFF' },

  listContent: { paddingBottom: 30 },
  emptyContainer: { marginTop: 40, alignItems: 'center' },
  emptyText: { color: '#8E8E93', fontSize: 16, fontWeight: '600' },

  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardLight: { backgroundColor: '#FFFFFF' },
  cardDark: { backgroundColor: '#1C1C1E' },
  taskLeft: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, paddingRight: 10 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#C7C7CC',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginRight: 12,
  },
  checkboxDark: { borderColor: '#3A3A3C' },
  checkboxCompleted: { backgroundColor: '#34C759', borderColor: '#34C759' },
  checkmark: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  textContainer: { flex: 1 },
  taskText: { fontSize: 16, fontWeight: '600', lineHeight: 20 },
  taskTextCompleted: { textDecorationLine: 'line-through', opacity: 0.55 },
  metadataRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  categoryPill: {
    backgroundColor: '#F2F2F7',
    color: '#1C1C1E',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },
  scheduleText: { fontSize: 12, color: '#8E8E93', fontWeight: '600' },
  deleteText: { color: '#FF3B30', fontSize: 14, fontWeight: '700' },
});
