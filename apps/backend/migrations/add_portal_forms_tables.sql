-- Create contact_submissions table
CREATE TABLE contact_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    subject VARCHAR(500),
    message TEXT NOT NULL,
    source VARCHAR(20) NOT NULL CHECK (source IN ('walk-in', 'internet', 'phone', 'service')),
    status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'responded', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_contact_submissions_status ON contact_submissions(status);
CREATE INDEX idx_contact_submissions_created_at ON contact_submissions(created_at DESC);

-- Create demo_requests table
CREATE TABLE demo_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    product_interest TEXT,
    preferred_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_demo_requests_status ON demo_requests(status);
CREATE INDEX idx_demo_requests_created_at ON demo_requests(created_at DESC);

-- Create updated_at trigger function (if it doesn't exist)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Attach triggers
CREATE TRIGGER update_contact_submissions_updated_at BEFORE UPDATE ON contact_submissions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_demo_requests_updated_at BEFORE UPDATE ON demo_requests
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
