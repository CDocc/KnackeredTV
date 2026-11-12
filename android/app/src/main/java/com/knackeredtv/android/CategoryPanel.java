package com.knackeredtv.android;

import android.content.Context;
import android.text.TextUtils;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import java.util.ArrayList;
import java.util.List;

/** The "Categories" glass panel shown to the left of the Live TV, Movies and Series grids. */
final class CategoryPanel extends LinearLayout {
    interface OnSelect { void select(Media.Category category); }

    private final List<Media.Category> categories = new ArrayList<>();
    private final RecyclerView list;
    private final OnSelect onSelect;
    private String selectedId;

    CategoryPanel(Context c, OnSelect onSelect) {
        super(c);
        this.onSelect = onSelect;
        setOrientation(VERTICAL);
        setBackgroundResource(R.drawable.bg_glass_panel);
        int pad = Ui.dp(c, 12);
        setPadding(pad, pad, pad, pad);
        TextView title = Ui.text(c, "Categories", 18, Ui.WHITE, true);
        title.setPadding(Ui.dp(c, 4), 0, 0, Ui.dp(c, 8));
        addView(title);
        list = new RecyclerView(c);
        list.setLayoutManager(new LinearLayoutManager(c));
        list.setAdapter(new Adapter());
        list.setItemAnimator(null);
        addView(list, new LayoutParams(-1, 0, 1));
    }

    void setCategories(List<Media.Category> next, String selected) {
        categories.clear();
        categories.addAll(next);
        selectedId = selected;
        list.getAdapter().notifyDataSetChanged();
    }

    private final class Adapter extends RecyclerView.Adapter<RecyclerView.ViewHolder> {
        @Override public int getItemCount() { return categories.size(); }

        @Override public RecyclerView.ViewHolder onCreateViewHolder(ViewGroup parent, int type) {
            Context c = parent.getContext();
            TextView view = Ui.text(c, "", 15, Ui.WHITE70, false);
            view.setBackgroundResource(R.drawable.bg_nav_item);
            view.setFocusable(true);
            view.setClickable(true);
            view.setSingleLine(true);
            view.setEllipsize(TextUtils.TruncateAt.END);
            int h = Ui.dp(c, Ui.compact(c) ? 10 : 14), w = Ui.dp(c, 14);
            view.setPadding(w, h, w, h);
            RecyclerView.LayoutParams params = new RecyclerView.LayoutParams(-1, -2);
            params.bottomMargin = Ui.dp(c, 6);
            view.setLayoutParams(params);
            return new RecyclerView.ViewHolder(view) {};
        }

        @Override public void onBindViewHolder(RecyclerView.ViewHolder holder, int position) {
            Media.Category category = categories.get(position);
            TextView view = (TextView) holder.itemView;
            view.setText(category.name);
            boolean selected = category.id.equals(selectedId);
            view.setSelected(selected);
            view.setTextColor(selected ? Ui.WHITE : Ui.WHITE70);
            view.setOnClickListener(v -> {
                if (category.id.equals(selectedId)) return;
                selectedId = category.id;
                notifyDataSetChanged();
                onSelect.select(category);
            });
        }
    }
}
