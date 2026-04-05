/**
 * TaskSubmissionForm Component
 *
 * Form for submitting new tasks to the agentic layer.
 * Uses client-side form handling and validation.
 */

'use client';

import { useState } from 'react';
import { tasksApi } from '@/lib/api/tasks';

export function TaskSubmissionForm() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState<string>('feature');
  const [priority, setPriority] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      await tasksApi.create({ title, description, task_type: taskType, priority });

      // Reset form
      setTitle('');
      setDescription('');
      setTaskType('feature');
      setPriority(5);
      setSuccess(true);

      // Reload page to show new task
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit task');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div>
        <label htmlFor="title" className="mb-1 block text-sm font-medium text-gray-700">
          Title
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={3}
          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          placeholder="Add dark mode toggle"
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          minLength={10}
          rows={4}
          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          placeholder="Implement dark mode toggle in settings page with persistence..."
        />
      </div>

      {/* Task Type */}
      <div>
        <label htmlFor="taskType" className="mb-1 block text-sm font-medium text-gray-700">
          Task Type
        </label>
        <select
          id="taskType"
          value={taskType}
          onChange={(e) => setTaskType(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          <option value="feature">Feature</option>
          <option value="bug">Bug Fix</option>
          <option value="refactor">Refactor</option>
          <option value="docs">Documentation</option>
          <option value="test">Tests</option>
        </select>
      </div>

      {/* Priority */}
      <div>
        <label htmlFor="priority" className="mb-1 block text-sm font-medium text-gray-700">
          Priority: {priority}
        </label>
        <input
          id="priority"
          type="range"
          min="1"
          max="10"
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value))}
          className="w-full"
        />
        <div className="mt-1 flex justify-between text-xs text-gray-500">
          <span>Highest (1)</span>
          <span>Lowest (10)</span>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={submitting}
        className={`w-full rounded-md px-4 py-2 font-medium transition ${
          submitting ? 'cursor-not-allowed bg-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {submitting ? 'Submitting...' : 'Submit to Agents'}
      </button>

      {/* Success Message */}
      {success && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Task submitted successfully! Agents will begin execution.
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
    </form>
  );
}
