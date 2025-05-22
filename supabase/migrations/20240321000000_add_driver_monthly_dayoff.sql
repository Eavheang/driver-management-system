-- Drop policies
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.driver_monthly_dayoff;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.driver_monthly_dayoff;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.driver_monthly_dayoff;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.driver_monthly_dayoff;

-- Drop triggers
DROP TRIGGER IF EXISTS create_monthly_dayoff_schedules_trigger ON public.driver_monthly_dayoff;
DROP TRIGGER IF EXISTS update_driver_monthly_dayoff_updated_at ON public.driver_monthly_dayoff;

-- Drop functions
DROP FUNCTION IF EXISTS public.create_monthly_dayoff_schedules();

-- Drop table
DROP TABLE IF EXISTS public.driver_monthly_dayoff;

-- Create driver_monthly_dayoff table
CREATE TABLE public.driver_monthly_dayoff (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 6 = Saturday
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(driver_id, month, year)
);

-- Add indexes for better query performance
CREATE INDEX idx_driver_monthly_dayoff_driver ON public.driver_monthly_dayoff(driver_id);
CREATE INDEX idx_driver_monthly_dayoff_month_year ON public.driver_monthly_dayoff(month, year);

-- Create updated_at function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_driver_monthly_dayoff_updated_at
    BEFORE UPDATE ON public.driver_monthly_dayoff
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add function to automatically create schedule entries for monthly day-offs
CREATE OR REPLACE FUNCTION public.create_monthly_dayoff_schedules()
RETURNS TRIGGER AS $$
DECLARE
    current_date DATE;
    last_day DATE;
BEGIN
    -- Calculate the first and last day of the month
    current_date := make_date(NEW.year, NEW.month, 1);
    last_day := (current_date + interval '1 month - 1 day')::date;
    
    -- Loop through all dates in the month
    WHILE current_date <= last_day LOOP
        -- If the day of week matches
        IF EXTRACT(DOW FROM current_date) = NEW.day_of_week THEN
            -- Insert or update schedule
            INSERT INTO public.schedules (driver_id, date, is_day_off)
            VALUES (NEW.driver_id, current_date, true)
            ON CONFLICT (driver_id, date) 
            DO UPDATE SET is_day_off = true, updated_at = NOW();
        END IF;
        
        current_date := current_date + interval '1 day';
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically create schedule entries
CREATE TRIGGER create_monthly_dayoff_schedules_trigger
    AFTER INSERT OR UPDATE ON public.driver_monthly_dayoff
    FOR EACH ROW
    EXECUTE FUNCTION public.create_monthly_dayoff_schedules();

-- Enable RLS
ALTER TABLE public.driver_monthly_dayoff ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable insert access for authenticated users" ON public.driver_monthly_dayoff
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable read access for authenticated users" ON public.driver_monthly_dayoff
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable update access for authenticated users" ON public.driver_monthly_dayoff
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete access for authenticated users" ON public.driver_monthly_dayoff
    FOR DELETE TO authenticated USING (true);

-- Grant permissions
GRANT ALL ON public.driver_monthly_dayoff TO authenticated; 