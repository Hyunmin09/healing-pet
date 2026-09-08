use serde::Serialize;

/// Monitor geometry extracted from the OS.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorInfo {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
}

/// Usable rectangular area after subtracting taskbar / bezel margins.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[expect(dead_code, reason = "consumed by the frontend in todo 3+")]
pub struct Bounds {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}

/// Bottom margin in logical pixels reserved for the taskbar.
#[expect(dead_code, reason = "consumed by the frontend in todo 3+")]
const BOTTOM_MARGIN: i32 = 48;
/// Side margin in logical pixels reserved for bezels / snap zones.
#[expect(dead_code, reason = "consumed by the frontend in todo 3+")]
const SIDE_MARGIN: i32 = 12;

/// Compute the usable bounds of a monitor, subtracting taskbar / bezel margins.
///
/// * Bottom 48 logical pixels are reserved (taskbar).
/// * Left and right 12 logical pixels are reserved (snap zones).
#[expect(dead_code, reason = "consumed by the frontend in todo 3+")]
pub fn bounds_for_monitor(mon: &MonitorInfo) -> Bounds {
    Bounds {
        x: mon.x + SIDE_MARGIN,
        y: mon.y,
        w: mon.width as i32 - SIDE_MARGIN * 2,
        h: mon.height as i32 - BOTTOM_MARGIN,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bounds_subtract_margins_for_full_hd() {
        let mon = MonitorInfo {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
            scale_factor: 1.0,
        };
        let b = bounds_for_monitor(&mon);
        assert_eq!(b.x, 12, "left margin");
        assert_eq!(b.y, 0, "top unchanged");
        assert_eq!(b.w, 1920 - 24, "width minus both side margins");
        assert_eq!(b.h, 1080 - 48, "height minus bottom margin");
    }

    #[test]
    fn bounds_offset_for_secondary_monitor() {
        let mon = MonitorInfo {
            x: 1920,
            y: 0,
            width: 2560,
            height: 1440,
            scale_factor: 1.5,
        };
        let b = bounds_for_monitor(&mon);
        assert_eq!(b.x, 1920 + 12);
        assert_eq!(b.w, 2560 - 24);
        assert_eq!(b.h, 1440 - 48);
    }

    #[test]
    fn bounds_handles_small_display() {
        let mon = MonitorInfo {
            x: 0,
            y: 0,
            width: 800,
            height: 600,
            scale_factor: 1.0,
        };
        let b = bounds_for_monitor(&mon);
        assert!(b.w > 0, "width must stay positive");
        assert!(b.h > 0, "height must stay positive");
    }
}
