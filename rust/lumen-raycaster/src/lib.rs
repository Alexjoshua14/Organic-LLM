//! Organic LLM — 2D Signed-Distance Field (SDF) & Single-Bounce Character Lumen Raycaster
//!
//! Dependency-free Rust kernel (`wasm32-unknown-unknown` and native ARM64/x86_64 compatible).
//! Models each glyph in the Auto-routed model title as an emissive 2D capsule segment inside
//! a dark rounded-rectangle pill cavity (`sdf_rounded_box`), casting stratified 2D rays to
//! compute inverse-square direct radiance, analytic SDF boundary normals, single-bounce
//! reflection vectors, and grazing-angle chromatic dispersion.

use core::f32::consts::TAU;

/// Activity state codes matching `UserComposerActivityState` in TypeScript:
/// 0 = typing, 1 = thinking, 2 = reviewing, 3 = idle, 4 = disconnected.
#[repr(u32)]
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum ActivityCode {
    Typing = 0,
    Thinking = 1,
    Reviewing = 2,
    Idle = 3,
    Disconnected = 4,
}

impl ActivityCode {
    #[inline]
    pub fn from_u32(code: u32) -> Self {
        match code {
            0 => Self::Typing,
            1 => Self::Thinking,
            2 => Self::Reviewing,
            3 => Self::Idle,
            _ => Self::Disconnected,
        }
    }

    #[inline]
    pub fn energy_multiplier(self) -> f32 {
        match self {
            Self::Typing => 1.18,
            Self::Thinking => 1.08,
            Self::Reviewing => 1.00,
            Self::Idle => 0.72,
            Self::Disconnected => 0.38,
        }
    }
}

/// Per-character lumen output struct (FFI-safe `#[repr(C)]` layout, 5 x f32 = 20 bytes).
#[repr(C)]
#[derive(Copy, Clone, Debug, Default)]
pub struct GlyphLumenOutput {
    pub glow_intensity: f32,
    pub bounce_irradiance: f32,
    pub specular_highlight: f32,
    pub hue_shift_deg: f32,
    pub direct_irradiance: f32,
}

/// Exact 2D Signed-Distance Field for a rounded box centered at `(0, 0)` with
/// `half_w`, `half_h`, and `corner_radius`.
/// Negative inside the pill cavity, `0.0` on the boundary, positive outside.
#[no_mangle]
pub extern "C" fn sdf_rounded_box(
    px: f32,
    py: f32,
    half_w: f32,
    half_h: f32,
    corner_radius: f32,
) -> f32 {
    let max_r = half_w.min(half_h).max(0.0);
    let r = corner_radius.clamp(0.0, max_r);
    let qx = px.abs() - (half_w - r);
    let qy = py.abs() - (half_h - r);
    let out_x = qx.max(0.0);
    let out_y = qy.max(0.0);
    let outside = (out_x * out_x + out_y * out_y).sqrt();
    let inside = qx.max(qy).min(0.0);
    outside + inside - r
}

/// Exact 2D Signed-Distance Field for a capsule / line segment from `(ax, ay)` to `(bx, by)`
/// with thickness `radius`.
#[no_mangle]
pub extern "C" fn sdf_capsule_segment(
    px: f32,
    py: f32,
    ax: f32,
    ay: f32,
    bx: f32,
    by: f32,
    radius: f32,
) -> f32 {
    let pax = px - ax;
    let pay = py - ay;
    let bax = bx - ax;
    let bay = by - ay;
    let denom = (bax * bax + bay * bay).max(1e-8);
    let h = ((pax * bax + pay * bay) / denom).clamp(0.0, 1.0);
    let dx = pax - bax * h;
    let dy = pay - bay * h;
    (dx * dx + dy * dy).sqrt() - radius
}

/// Unit outward normal `(nx, ny)` of `sdf_rounded_box` at `(px, py)` via symmetric central differences.
#[inline]
pub fn sdf_rounded_box_normal(
    px: f32,
    py: f32,
    half_w: f32,
    half_h: f32,
    corner_radius: f32,
) -> (f32, f32) {
    let eps = 0.25_f32;
    let dx = sdf_rounded_box(px + eps, py, half_w, half_h, corner_radius)
        - sdf_rounded_box(px - eps, py, half_w, half_h, corner_radius);
    let dy = sdf_rounded_box(px, py + eps, half_w, half_h, corner_radius)
        - sdf_rounded_box(px, py - eps, half_w, half_h, corner_radius);
    let len = (dx * dx + dy * dy).sqrt();
    if len <= 1e-6 {
        (0.0, -1.0)
    } else {
        (dx / len, dy / len)
    }
}

/// Inverse-square falloff attenuation: `I0 / (1 + k1 * d + k2 * d^2)`.
#[no_mangle]
pub extern "C" fn inverse_square_falloff(distance: f32, intensity0: f32, k1: f32, k2: f32) -> f32 {
    let d = distance.max(0.0);
    intensity0 / (1.0 + k1 * d + k2 * d * d)
}

/// Sphere-traces a 2D ray from an interior point `(ox, oy)` along unit direction `(dx, dy)`
/// until it intersects the inner wall of the rounded pill box.
/// Returns `(hit_distance, hit_x, hit_y, nx, ny, refl_dx, refl_dy, cos_incidence)`.
#[inline]
pub fn march_to_pill_boundary(
    ox: f32,
    oy: f32,
    dx: f32,
    dy: f32,
    half_w: f32,
    half_h: f32,
    corner_radius: f32,
) -> (f32, f32, f32, f32, f32, f32, f32, f32) {
    let mut t = 0.0_f32;
    let max_t = (half_w * 2.5 + half_h * 2.5).max(16.0);

    for _ in 0..16 {
        let px = ox + dx * t;
        let py = oy + dy * t;
        let sdf = sdf_rounded_box(px, py, half_w, half_h, corner_radius);
        let dist_to_wall = -sdf;
        if dist_to_wall <= 0.35 || t >= max_t {
            break;
        }
        t += dist_to_wall.max(0.5);
    }

    let hit_x = ox + dx * t;
    let hit_y = oy + dy * t;
    let (nx, ny) = sdf_rounded_box_normal(hit_x, hit_y, half_w, half_h, corner_radius);
    let dot_dn = dx * nx + dy * ny;
    let refl_dx = dx - 2.0 * dot_dn * nx;
    let refl_dy = dy - 2.0 * dot_dn * ny;
    let cos_incidence = dot_dn.abs().clamp(0.0, 1.0);

    (t, hit_x, hit_y, nx, ny, refl_dx, refl_dy, cos_incidence)
}

/// FFI entry point: computes per-character lumen parameters for `glyph_count` characters.
///
/// # Safety
/// `glyph_weights_ptr` must point to at least `glyph_count` `f32` values, and `out_ptr`
/// must point to at least `glyph_count` `GlyphLumenOutput` elements.
#[no_mangle]
pub unsafe extern "C" fn compute_glyph_lumen(
    glyph_weights_ptr: *const f32,
    glyph_count: usize,
    pill_width: f32,
    pill_height: f32,
    corner_radius: f32,
    ray_count: usize,
    activity_code: u32,
    time_sec: f32,
    out_ptr: *mut GlyphLumenOutput,
) -> usize {
    if glyph_weights_ptr.is_null() || out_ptr.is_null() || glyph_count == 0 {
        return 0;
    }

    let weights = core::slice::from_raw_parts(glyph_weights_ptr, glyph_count);
    let outputs = core::slice::from_raw_parts_mut(out_ptr, glyph_count);

    let half_w = (pill_width * 0.5).max(12.0);
    let half_h = (pill_height * 0.5).max(8.0);
    let rays = ray_count.clamp(4, 64);
    let activity = ActivityCode::from_u32(activity_code);
    let energy = activity.energy_multiplier();

    let usable_span = (pill_width - 16.0).max(8.0);
    let step_x = if glyph_count > 1 {
        usable_span / (glyph_count as f32)
    } else {
        0.0
    };
    let start_x = -usable_span * 0.5 + step_x * 0.5;
    let seg_half = (step_x * 0.36).clamp(1.2, 5.0);

    for i in 0..glyph_count {
        let gx = if glyph_count > 1 {
            start_x + (i as f32) * step_x
        } else {
            0.0
        };
        let gy = 0.0_f32;
        let w_i = weights[i].clamp(0.15, 1.25);

        let phase = time_sec * 1.8 + (i as f32) * 0.42;
        let pulse = 1.0 + 0.08 * phase.sin();

        let mut direct_sum = 0.0_f32;
        for j in 0..glyph_count {
            let nx_pos = if glyph_count > 1 {
                start_x + (j as f32) * step_x
            } else {
                0.0
            };
            let w_j = weights[j].clamp(0.15, 1.25);
            let d = sdf_capsule_segment(
                gx,
                gy,
                nx_pos - seg_half,
                0.0,
                nx_pos + seg_half,
                0.0,
                1.2,
            )
            .max(0.0);
            direct_sum += inverse_square_falloff(d, w_j * energy * pulse, 0.09, 0.018);
        }
        let direct_irradiance = (direct_sum / (glyph_count as f32).sqrt()).clamp(0.0, 1.5);

        let mut bounce_sum = 0.0_f32;
        let mut spec_sum = 0.0_f32;
        let mut dispersion_sum = 0.0_f32;

        for r in 0..rays {
            let theta = TAU * ((r as f32) + 0.5) / (rays as f32);
            let dx = theta.cos();
            let dy = theta.sin();

            let (t_wall, hit_x, hit_y, _nx, _ny, refl_dx, refl_dy, cos_inc) =
                march_to_pill_boundary(gx, gy, dx, dy, half_w, half_h, corner_radius);

            let wall_attenuation = inverse_square_falloff(t_wall, energy * w_i, 0.045, 0.004);
            let fresnel = 0.22 + 0.78 * (1.0 - cos_inc).powi(3);

            // Single-bounce march along reflected vector back toward baseline glyph core
            let bounce_probe_dist = (half_h * 0.85).max(4.0);
            let bx = hit_x + refl_dx * bounce_probe_dist;
            let by = hit_y + refl_dy * bounce_probe_dist;
            let dist_to_core = sdf_capsule_segment(
                bx,
                by,
                -usable_span * 0.45,
                0.0,
                usable_span * 0.45,
                0.0,
                2.0,
            )
            .max(0.0);

            let bounce_return = inverse_square_falloff(dist_to_core, wall_attenuation, 0.06, 0.008);
            bounce_sum += bounce_return * (0.55 + 0.45 * cos_inc);
            spec_sum += wall_attenuation * fresnel;
            dispersion_sum += (1.0 - cos_inc) * dx.signum();
        }

        let inv_rays = 1.0 / (rays as f32);
        let bounce_irradiance = (bounce_sum * inv_rays * 1.35).clamp(0.0, 1.2);
        let specular_highlight = (spec_sum * inv_rays * 1.15).clamp(0.0, 1.0);
        let glow_intensity =
            (direct_irradiance * 0.58 + bounce_irradiance * 0.42).clamp(0.08, 1.0);
        let norm_x = (gx / half_w).clamp(-1.0, 1.0);
        let hue_shift_deg =
            ((dispersion_sum * inv_rays * 18.0) + norm_x * 6.5).clamp(-14.0, 14.0);

        outputs[i] = GlyphLumenOutput {
            glow_intensity,
            bounce_irradiance,
            specular_highlight,
            hue_shift_deg,
            direct_irradiance,
        };
    }

    glyph_count
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rounded_box_sdf_is_negative_inside_and_positive_outside() {
        let inside = sdf_rounded_box(0.0, 0.0, 40.0, 14.0, 8.0);
        let on_top_edge = sdf_rounded_box(0.0, 14.0, 40.0, 14.0, 8.0);
        let outside = sdf_rounded_box(55.0, 0.0, 40.0, 14.0, 8.0);
        assert!(inside < 0.0);
        assert!(on_top_edge.abs() < 1e-4);
        assert!(outside > 0.0);
    }

    #[test]
    fn computes_glyph_lumen_outputs() {
        let weights = [1.0_f32, 0.9, 0.9, 0.9, 0.85, 0.85];
        let mut out = [GlyphLumenOutput::default(); 6];
        let count = unsafe {
            compute_glyph_lumen(
                weights.as_ptr(),
                weights.len(),
                76.0,
                26.0,
                8.0,
                16,
                ActivityCode::Typing as u32,
                0.25,
                out.as_mut_ptr(),
            )
        };
        assert_eq!(count, 6);
        assert!(out[0].glow_intensity > 0.1);
        assert!(out[0].bounce_irradiance > 0.0);
    }
}
