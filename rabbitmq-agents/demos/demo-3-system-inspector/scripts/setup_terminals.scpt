
-- Terminal Setup - Window ID Capture v3.0
-- 3 terminal açılacak, her birinin ID'si yakalanacak

tell application "Terminal"
    -- Window ID listesi
    set windowIDs to {}

    -- Önce Terminal'i aktif et
    activate
    delay 0.5

    -- Mevcut pencereleri kapat (temiz başlangıç)
    try
        close every window
    end try
    delay 0.3


    -- Terminal 1: LEADER
    do script ""
    delay 0.3

    -- HEMEN Window ID'yi yakala (Claude title değiştirmeden önce!)
    set currentWindowID to id of window 1
    set end of windowIDs to currentWindowID

    tell window 1
        -- Boyut ve pozisyon
        set bounds to {1280, 0, 1920, 1080}
        set custom title to "LEADER"
        set title displays custom title to true
        -- Koyu arka plan (RGB: siyah)
        set background color to {0, 0, 0}
        -- Beyaz metin (RGB: beyaz)
        set normal text color to {65535, 65535, 65535}
    end tell
    delay 0.3


    -- Terminal 2: WORKER-1
    do script ""
    delay 0.3

    -- HEMEN Window ID'yi yakala (Claude title değiştirmeden önce!)
    set currentWindowID to id of window 1
    set end of windowIDs to currentWindowID

    tell window 1
        -- Boyut ve pozisyon
        set bounds to {1920, 0, 2560, 1080}
        set custom title to "WORKER-1"
        set title displays custom title to true
        -- Koyu arka plan (RGB: siyah)
        set background color to {0, 0, 0}
        -- Beyaz metin (RGB: beyaz)
        set normal text color to {65535, 65535, 65535}
    end tell
    delay 0.3


    -- Terminal 3: WORKER-2
    do script ""
    delay 0.3

    -- HEMEN Window ID'yi yakala (Claude title değiştirmeden önce!)
    set currentWindowID to id of window 1
    set end of windowIDs to currentWindowID

    tell window 1
        -- Boyut ve pozisyon
        set bounds to {2560, 0, 3200, 1080}
        set custom title to "WORKER-2"
        set title displays custom title to true
        -- Koyu arka plan (RGB: siyah)
        set background color to {0, 0, 0}
        -- Beyaz metin (RGB: beyaz)
        set normal text color to {65535, 65535, 65535}
    end tell
    delay 0.3


    -- Window ID'leri virgülle ayrılmış string olarak döndür
    set idString to ""
    repeat with i from 1 to count of windowIDs
        if i > 1 then
            set idString to idString & ","
        end if
        set idString to idString & (item i of windowIDs as string)
    end repeat

    return idString
end tell
