package com.knackeredtv.android;

import android.app.Activity;
import android.content.Context;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Outline;
import android.graphics.Rect;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.os.Build;
import android.text.InputType;
import android.util.TypedValue;
import android.view.DisplayCutout;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewOutlineProvider;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

/** The desktop app's look (glass panels, blue gradients, focus rings) as small view factories. */
final class Ui {
    static final int WHITE = 0xFFFFFFFF;
    static final int WHITE80 = 0xCCFFFFFF;
    static final int WHITE70 = 0xB3FFFFFF;
    static final int WHITE60 = 0x99FFFFFF;
    static final int WHITE50 = 0x80FFFFFF;
    static final int WHITE40 = 0x66FFFFFF;
    static final int BLUE = 0xFF3B82F6;
    static final int YELLOW = 0xFFFDE047;
    static final int GREEN = 0xFF4ADE80;
    static final int RED = 0xFFF87171;

    private Ui() {}

    static int dp(Context c, float value) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, c.getResources().getDisplayMetrics()));
    }

    static int widthDp(Context c) { return c.getResources().getConfiguration().screenWidthDp; }

    static int heightDp(Context c) { return c.getResources().getConfiguration().screenHeightDp; }

    /** Phones in landscape are only ~360dp tall, so spacing and the sidebar shrink there. */
    static boolean compact(Context c) { return heightDp(c) < 480; }

    static boolean isTv(Context c) {
        return (c.getResources().getConfiguration().uiMode & Configuration.UI_MODE_TYPE_MASK) == Configuration.UI_MODE_TYPE_TELEVISION;
    }

    static TextView text(Context c, CharSequence value, float sp, int color, boolean bold) {
        TextView view = new TextView(c);
        view.setText(value);
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        view.setTextColor(color);
        if (bold) view.setTypeface(Typeface.DEFAULT_BOLD);
        return view;
    }

    /** The desktop's cyan to blue gradient title text. */
    static TextView gradientTitle(Context c, CharSequence value, float sp) {
        TextView view = text(c, value, sp, 0xFF00D4FF, true);
        float width = view.getPaint().measureText(value.toString());
        view.getPaint().setShader(new LinearGradient(0, 0, Math.max(1, width), 0, 0xFF00D4FF, 0xFF0099FF, Shader.TileMode.CLAMP));
        return view;
    }

    static void setBackground(View view, int drawable) { view.setBackgroundResource(drawable); }

    static LinearLayout panel(Context c) {
        LinearLayout layout = new LinearLayout(c);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setBackgroundResource(R.drawable.bg_glass_panel);
        return layout;
    }

    static LinearLayout card(Context c) {
        LinearLayout layout = new LinearLayout(c);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setBackgroundResource(R.drawable.bg_glass_card);
        return layout;
    }

    private static TextView buttonBase(Context c, CharSequence label, int background, int color, float sp, boolean bold) {
        TextView view = text(c, label, sp, color, bold);
        view.setGravity(Gravity.CENTER);
        view.setBackgroundResource(background);
        view.setFocusable(true);
        view.setClickable(true);
        int h = dp(c, compact(c) ? 8 : 10), w = dp(c, 18);
        view.setPadding(w, h, w, h);
        return view;
    }

    static TextView glassButton(Context c, CharSequence label, Runnable click) {
        TextView view = buttonBase(c, label, R.drawable.bg_glass_button, WHITE, 14, false);
        view.setOnClickListener(v -> click.run());
        return view;
    }

    static TextView primaryButton(Context c, CharSequence label, Runnable click) {
        TextView view = buttonBase(c, label, R.drawable.bg_primary_button, WHITE, 15, true);
        view.setOnClickListener(v -> click.run());
        return view;
    }

    static TextView dangerButton(Context c, CharSequence label, Runnable click) {
        TextView view = buttonBase(c, label, R.drawable.bg_danger_button, 0xFFFECACA, 14, true);
        view.setOnClickListener(v -> click.run());
        return view;
    }

    static EditText input(Context c, String hint, boolean password) {
        EditText edit = new EditText(c);
        edit.setHint(hint);
        edit.setHintTextColor(WHITE40);
        edit.setTextColor(WHITE);
        edit.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        edit.setSingleLine(true);
        edit.setBackgroundResource(R.drawable.bg_input);
        edit.setImeOptions(EditorInfo.IME_ACTION_DONE | EditorInfo.IME_FLAG_NO_EXTRACT_UI);
        edit.setInputType(password ? InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD : InputType.TYPE_CLASS_TEXT);
        int h = dp(c, compact(c) ? 8 : 10), w = dp(c, 14);
        edit.setPadding(w, h, w, h);
        return edit;
    }

    static ProgressBar spinner(Context c) {
        ProgressBar bar = new ProgressBar(c);
        bar.getIndeterminateDrawable().setColorFilter(BLUE, android.graphics.PorterDuff.Mode.SRC_IN);
        return bar;
    }

    /** Centered spinner with a caption, used while a page loads. */
    static LinearLayout loading(Context c, String message) {
        LinearLayout box = new LinearLayout(c);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.addView(spinner(c), new LinearLayout.LayoutParams(dp(c, 40), dp(c, 40)));
        TextView caption = text(c, message, 14, WHITE60, false);
        caption.setGravity(Gravity.CENTER);
        caption.setPadding(0, dp(c, 12), 0, 0);
        box.addView(caption);
        return box;
    }

    static TextView errorBox(Context c, String message) {
        TextView view = text(c, message, 13, 0xFFFECACA, false);
        view.setBackgroundResource(R.drawable.bg_error);
        int p = dp(c, 12);
        view.setPadding(p, p, p, p);
        return view;
    }

    static TextView message(Context c, String message) {
        TextView view = text(c, message, 15, WHITE60, false);
        view.setGravity(Gravity.CENTER);
        return view;
    }

    static void roundClip(View view, float radiusDp) {
        float radius = dp(view.getContext(), radiusDp);
        view.setOutlineProvider(new ViewOutlineProvider() {
            @Override public void getOutline(View v, Outline outline) {
                outline.setRoundRect(0, 0, v.getWidth(), v.getHeight(), radius);
            }
        });
        view.setClipToOutline(true);
    }

    static LinearLayout.LayoutParams lp(int w, int h) { return new LinearLayout.LayoutParams(w, h); }

    static LinearLayout.LayoutParams weight(float weight) { return new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, weight); }

    static LinearLayout.LayoutParams margins(LinearLayout.LayoutParams params, int l, int t, int r, int b) {
        params.setMargins(l, t, r, b);
        return params;
    }

    interface InsetsListener { void onInsets(Rect insets); }

    /** System bar and display-cutout (notch / punch-hole) insets, whichever is larger per side. */
    static Rect safeInsets(WindowInsets insets) {
        Rect result = new Rect(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
        if (Build.VERSION.SDK_INT >= 28) {
            DisplayCutout cutout = insets.getDisplayCutout();
            if (cutout != null) {
                result.left = Math.max(result.left, cutout.getSafeInsetLeft());
                result.top = Math.max(result.top, cutout.getSafeInsetTop());
                result.right = Math.max(result.right, cutout.getSafeInsetRight());
                result.bottom = Math.max(result.bottom, cutout.getSafeInsetBottom());
            }
        }
        return result;
    }

    static void watchInsets(View view, InsetsListener listener) {
        view.setOnApplyWindowInsetsListener((v, insets) -> {
            listener.onInsets(safeInsets(insets));
            return insets;
        });
    }

    /** Keeps content out from under cutouts and system bars while the background still fills the screen. */
    static void applyInsets(View root, int paddingPx) {
        root.setPadding(paddingPx, paddingPx, paddingPx, paddingPx);
        watchInsets(root, r -> root.setPadding(paddingPx + r.left, paddingPx + r.top, paddingPx + r.right, paddingPx + r.bottom));
    }

    /** Lets the window draw into the camera cutout area so the app uses the whole screen in landscape. */
    static void allowCutout(Activity activity) {
        if (Build.VERSION.SDK_INT >= 28) {
            activity.getWindow().getAttributes().layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
    }

    /**
     * Fills its parent and centres one child, optionally shrunk to a fixed aspect ratio
     * (used for the player's 16:9 and 4:3 screen sizes). A ratio of 0 means "use the whole space".
     */
    static final class AspectBox extends FrameLayout {
        private float ratio;

        AspectBox(Context c) { super(c); }

        void setRatio(float value) {
            if (value != ratio) {
                ratio = value;
                requestLayout();
            }
        }

        @Override protected void onMeasure(int widthSpec, int heightSpec) {
            int width = MeasureSpec.getSize(widthSpec), height = MeasureSpec.getSize(heightSpec);
            setMeasuredDimension(width, height);
            int childWidth = width, childHeight = height;
            if (ratio > 0 && width > 0 && height > 0) {
                if (width / (float) height > ratio) childWidth = Math.round(height * ratio);
                else childHeight = Math.round(width / ratio);
            }
            for (int i = 0; i < getChildCount(); i++) {
                getChildAt(i).measure(MeasureSpec.makeMeasureSpec(childWidth, MeasureSpec.EXACTLY),
                        MeasureSpec.makeMeasureSpec(childHeight, MeasureSpec.EXACTLY));
            }
        }

        @Override protected void onLayout(boolean changed, int l, int t, int r, int b) {
            int width = r - l, height = b - t;
            for (int i = 0; i < getChildCount(); i++) {
                View child = getChildAt(i);
                int cw = child.getMeasuredWidth(), ch = child.getMeasuredHeight();
                int left = (width - cw) / 2, top = (height - ch) / 2;
                child.layout(left, top, left + cw, top + ch);
            }
        }
    }

    /** A frame whose height is a fixed multiple of its width (2:3 posters, 16:9 channel art). */
    static final class AspectFrame extends FrameLayout {
        private final float ratio;

        AspectFrame(Context c, float ratio) {
            super(c);
            this.ratio = ratio;
        }

        @Override protected void onMeasure(int widthSpec, int heightSpec) {
            int width = MeasureSpec.getSize(widthSpec);
            super.onMeasure(MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
                    MeasureSpec.makeMeasureSpec(Math.round(width * ratio), MeasureSpec.EXACTLY));
        }
    }

    static int parseColor(String hex) { return Color.parseColor(hex); }
}
