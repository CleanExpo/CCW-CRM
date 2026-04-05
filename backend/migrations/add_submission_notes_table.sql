-- Drop existing submission_notes table if it exists (development only)
DROP TABLE IF EXISTS submission_notes;

-- Create submission_notes table for tracking notes and activity
CREATE TABLE submission_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_type VARCHAR(20) NOT NULL CHECK (submission_type IN ('contact', 'demo')),
    submission_id UUID NOT NULL,
    note_type VARCHAR(20) NOT NULL DEFAULT 'note' CHECK (note_type IN ('note', 'status_change', 'email_sent')),
    content TEXT NOT NULL,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    meta_data TEXT
);

-- Create indexes for performance
CREATE INDEX idx_submission_notes_submission ON submission_notes(submission_type, submission_id);
CREATE INDEX idx_submission_notes_created_at ON submission_notes(created_at DESC);
CREATE INDEX idx_submission_notes_type ON submission_notes(note_type);
