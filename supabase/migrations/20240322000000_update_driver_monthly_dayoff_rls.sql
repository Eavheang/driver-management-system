-- Drop existing policies
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.driver_monthly_dayoff;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.driver_monthly_dayoff;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.driver_monthly_dayoff;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.driver_monthly_dayoff;

-- Create new, more restrictive policies
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