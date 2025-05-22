-- Create replacements table
CREATE TABLE IF NOT EXISTS public.replacements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
    replacement_driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create overtime_records table
CREATE TABLE IF NOT EXISTS public.overtime_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    hours DECIMAL(5,2) NOT NULL,
    ot_type TEXT NOT NULL CHECK (ot_type IN ('replacement', 'extension', 'special')),
    ot_rate DECIMAL(3,2) NOT NULL DEFAULT 1.5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_replacements_schedule_id ON public.replacements(schedule_id);
CREATE INDEX IF NOT EXISTS idx_replacements_replacement_driver_id ON public.replacements(replacement_driver_id);
CREATE INDEX IF NOT EXISTS idx_overtime_records_driver_id ON public.overtime_records(driver_id);
CREATE INDEX IF NOT EXISTS idx_overtime_records_date ON public.overtime_records(date);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_replacements_updated_at
    BEFORE UPDATE ON public.replacements
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_overtime_records_updated_at
    BEFORE UPDATE ON public.overtime_records
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column(); 