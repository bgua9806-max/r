-- =====================================================
-- CRM PHASE 2: Mở rộng bảng guest_profiles
-- Chạy lệnh này trong Supabase SQL Editor
-- =====================================================

-- Thêm các cột CRM mới (an toàn — IF NOT EXISTS)
ALTER TABLE guest_profiles ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT '';
ALTER TABLE guest_profiles ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE guest_profiles ADD COLUMN IF NOT EXISTS preferences TEXT DEFAULT '';
ALTER TABLE guest_profiles ADD COLUMN IF NOT EXISTS vip_tier TEXT DEFAULT '';

-- Tạo index để tìm kiếm nhanh theo phone
CREATE INDEX IF NOT EXISTS idx_guest_profiles_phone ON guest_profiles(phone);

-- Cho phép RLS policy đọc/ghi (nếu chưa có)
-- Nếu bảng đã có policy thì bỏ qua lệnh này
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'guest_profiles' AND policyname = 'Allow all for authenticated'
    ) THEN
        ALTER TABLE guest_profiles ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Allow all for authenticated" ON guest_profiles
            FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Xác nhận cấu trúc bảng sau khi chạy
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'guest_profiles' 
ORDER BY ordinal_position;
