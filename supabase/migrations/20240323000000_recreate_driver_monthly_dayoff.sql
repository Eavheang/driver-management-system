-- Drop functions first (no dependencies)
DROP FUNCTION IF EXISTS public.create_monthly_dayoff_schedules() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- Drop table (this will automatically drop dependent objects like triggers and policies)
DROP TABLE IF EXISTS public.driver_monthly_dayoff CASCADE;

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

-- Create updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_driver_monthly_dayoff_updated_at
    BEFORE UPDATE ON public.driver_monthly_dayoff
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add function to automatically create schedule entries for monthly day-offs
CREATE OR REPLACE FUNCTION public.create_monthly_dayoff_schedules()
RETURNS TRIGGER AS $$
DECLARE
    curr_date DATE;
    last_day DATE;
    local_dow INTEGER;
BEGIN
    -- Calculate the first and last day of the month
    curr_date := make_date(NEW.year, NEW.month, 1);
    last_day := (curr_date + interval '1 month - 1 day')::date;
    
    -- Delete any existing day-off entries for this driver in this month
    DELETE FROM public.schedules 
    WHERE driver_id = NEW.driver_id 
    AND date >= curr_date 
    AND date <= last_day 
    AND is_day_off = true;
    
    -- Loop through all dates in the month
    WHILE curr_date <= last_day LOOP
        -- Get the day of week in local time (0 = Sunday, 6 = Saturday)
        local_dow := EXTRACT(DOW FROM curr_date AT TIME ZONE 'Asia/Bangkok');
        
        -- If the day of week matches
        IF local_dow = NEW.day_of_week THEN
            -- Insert schedule
            INSERT INTO public.schedules (driver_id, date, is_day_off)
            VALUES (NEW.driver_id, curr_date, true)
            ON CONFLICT (driver_id, date) 
            DO UPDATE SET is_day_off = true, updated_at = NOW();
        END IF;
        
        curr_date := curr_date + interval '1 day';
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

-- Create RLS policies
-- Read policy: Allow users to read all records
CREATE POLICY "Enable read access for authenticated users" ON public.driver_monthly_dayoff
    FOR SELECT TO authenticated
    USING (true);

-- Insert policy: Allow users to insert records if they have access to the driver
CREATE POLICY "Enable insert access for authenticated users" ON public.driver_monthly_dayoff
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.drivers d
            WHERE d.id = driver_id
        )
    );

-- Update policy: Allow users to update records if they have access to the driver
CREATE POLICY "Enable update access for authenticated users" ON public.driver_monthly_dayoff
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.drivers d
            WHERE d.id = driver_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.drivers d
            WHERE d.id = driver_id
        )
    );

-- Delete policy: Allow users to delete records if they have access to the driver
CREATE POLICY "Enable delete access for authenticated users" ON public.driver_monthly_dayoff
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.drivers d
            WHERE d.id = driver_id
        )
    );

-- Grant permissions
GRANT ALL ON public.driver_monthly_dayoff TO authenticated; 