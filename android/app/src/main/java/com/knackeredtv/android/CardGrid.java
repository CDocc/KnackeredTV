package com.knackeredtv.android;

import android.content.Context;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.bumptech.glide.Glide;
import java.util.ArrayList;
import java.util.List;

/** A scrolling grid of poster / channel cards that shows the same artwork layout as the desktop app. */
final class CardGrid extends RecyclerView {
    private final List<Card> cards = new ArrayList<>();
    private final GridLayoutManager manager;
    private final int minCellPx;
    private final int gapPx;

    CardGrid(Context context, int minCellDp) {
        super(context);
        minCellPx = Ui.dp(context, minCellDp);
        gapPx = Ui.dp(context, 6);
        manager = new GridLayoutManager(context, 3);
        manager.setSpanSizeLookup(new GridLayoutManager.SpanSizeLookup() {
            @Override public int getSpanSize(int position) {
                return cards.get(position).type == Card.HEADER ? manager.getSpanCount() : 1;
            }
        });
        setLayoutManager(manager);
        setClipToPadding(false);
        setPadding(gapPx, gapPx, gapPx, gapPx);
        setHasFixedSize(false);
        addItemDecoration(new ItemDecoration() {
            @Override public void getItemOffsets(android.graphics.Rect out, View view, RecyclerView parent, State state) {
                out.set(gapPx, gapPx, gapPx, gapPx);
            }
        });
        setAdapter(new CardAdapter());
        setItemAnimator(null);
        setOverScrollMode(OVER_SCROLL_NEVER);
    }

    @Override protected void onSizeChanged(int w, int h, int oldw, int oldh) {
        super.onSizeChanged(w, h, oldw, oldh);
        manager.setSpanCount(Math.max(2, (w - 2 * gapPx) / minCellPx));
    }

    void setCards(List<Card> next) {
        cards.clear();
        cards.addAll(next);
        getAdapter().notifyDataSetChanged();
        scrollToPosition(0);
    }

    private final class CardAdapter extends Adapter<Holder> {
        @Override public int getItemCount() { return cards.size(); }

        @Override public int getItemViewType(int position) { return cards.get(position).type; }

        @Override public Holder onCreateViewHolder(ViewGroup parent, int type) {
            return new Holder(build(parent.getContext(), type), type);
        }

        @Override public void onBindViewHolder(Holder holder, int position) {
            Card card = cards.get(position);
            if (card.type == Card.HEADER) {
                holder.title.setText(card.title);
                return;
            }
            holder.root.setSelected(card.selected);
            holder.root.setOnClickListener(v -> { if (card.click != null) card.click.run(); });
            holder.title.setText(card.title);
            holder.subtitle.setText(card.subtitle);
            holder.subtitle.setVisibility(card.subtitle.isEmpty() ? View.GONE : View.VISIBLE);
            holder.letter.setText(card.type == Card.LIVE ? "📺" : initial(card.title));
            if (card.image.isEmpty()) {
                Glide.with(holder.image).clear(holder.image);
                holder.image.setImageDrawable(null);
            } else {
                Glide.with(holder.image).load(card.image).override(card.type == Card.LIVE ? 320 : 300, card.type == Card.LIVE ? 180 : 450)
                        .centerCrop().into(holder.image);
            }
            if (holder.rating != null) {
                holder.rating.setVisibility(card.rating > 0 ? View.VISIBLE : View.GONE);
                holder.rating.setText(String.format(java.util.Locale.ROOT, "★ %.1f", card.rating));
            }
            if (holder.progressRow != null) {
                holder.progressRow.setVisibility(card.progress > 0 ? View.VISIBLE : View.GONE);
                ((LinearLayout.LayoutParams) holder.progressFill.getLayoutParams()).weight = Math.max(1, card.progress * 1000);
                ((LinearLayout.LayoutParams) holder.progressRest.getLayoutParams()).weight = Math.max(0, (1 - card.progress) * 1000);
                holder.progressRow.requestLayout();
            }
            holder.star.setVisibility(card.toggleFavorite == null ? View.GONE : View.VISIBLE);
            styleStar(holder.star, card.favorite);
            holder.star.setOnClickListener(v -> {
                card.favorite = card.toggleFavorite.run();
                styleStar(holder.star, card.favorite);
            });
        }

        @Override public void onViewRecycled(Holder holder) {
            if (holder.image != null) Glide.with(holder.image).clear(holder.image);
        }
    }

    private static String initial(String title) {
        String trimmed = title.trim();
        return trimmed.isEmpty() ? "?" : trimmed.substring(0, trimmed.offsetByCodePoints(0, 1)).toUpperCase();
    }

    private static void styleStar(TextView star, boolean favorite) {
        star.setText(favorite ? "★" : "☆");
        star.setTextColor(favorite ? Ui.YELLOW : Ui.WHITE80);
    }

    private static View build(Context c, int type) {
        if (type == Card.HEADER) {
            TextView header = Ui.text(c, "", 18, Ui.WHITE, true);
            header.setPadding(Ui.dp(c, 4), Ui.dp(c, 12), 0, Ui.dp(c, 4));
            header.setTag(R.id.card_title, header);
            return header;
        }
        boolean live = type == Card.LIVE;
        LinearLayout root = new LinearLayout(c);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundResource(R.drawable.bg_card);
        root.setFocusable(true);
        root.setClickable(true);
        Ui.roundClip(root, 12);

        Ui.AspectFrame art = new Ui.AspectFrame(c, live ? 0.5625f : 1.5f);
        art.setBackgroundResource(live ? R.drawable.bg_live_art : R.drawable.bg_poster_placeholder);
        root.addView(art, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView letter = Ui.text(c, "", live ? 30 : 36, 0x4DFFFFFF, true);
        letter.setGravity(Gravity.CENTER);
        art.addView(letter, new FrameLayout.LayoutParams(-1, -1));
        ImageView image = new ImageView(c);
        image.setScaleType(ImageView.ScaleType.CENTER_CROP);
        art.addView(image, new FrameLayout.LayoutParams(-1, -1));

        TextView rating = null;
        LinearLayout progressRow = null;
        View fill = null, rest = null;
        if (!live) {
            rating = Ui.text(c, "", 12, Ui.YELLOW, true);
            rating.setBackgroundResource(R.drawable.bg_badge);
            rating.setPadding(Ui.dp(c, 6), Ui.dp(c, 2), Ui.dp(c, 6), Ui.dp(c, 2));
            FrameLayout.LayoutParams rp = new FrameLayout.LayoutParams(-2, -2, Gravity.TOP | Gravity.END);
            rp.setMargins(0, Ui.dp(c, 6), Ui.dp(c, 6), 0);
            art.addView(rating, rp);

            progressRow = new LinearLayout(c);
            fill = new View(c);
            fill.setBackgroundResource(R.drawable.bg_progress_fill);
            rest = new View(c);
            rest.setBackgroundResource(R.drawable.bg_progress_track);
            progressRow.addView(fill, new LinearLayout.LayoutParams(0, -1, 1));
            progressRow.addView(rest, new LinearLayout.LayoutParams(0, -1, 0));
            art.addView(progressRow, new FrameLayout.LayoutParams(-1, Ui.dp(c, 3), Gravity.BOTTOM));
        }

        TextView star = Ui.text(c, "☆", 18, Ui.WHITE80, false);
        star.setGravity(Gravity.CENTER);
        star.setBackgroundResource(R.drawable.bg_star);
        star.setFocusable(true);
        star.setClickable(true);
        int size = Ui.dp(c, 32);
        FrameLayout.LayoutParams sp = new FrameLayout.LayoutParams(size, size, Gravity.TOP | (live ? Gravity.END : Gravity.START));
        sp.setMargins(Ui.dp(c, 6), Ui.dp(c, 6), Ui.dp(c, 6), 0);
        art.addView(star, sp);

        LinearLayout info = new LinearLayout(c);
        info.setOrientation(LinearLayout.VERTICAL);
        info.setPadding(Ui.dp(c, 10), Ui.dp(c, 8), Ui.dp(c, 10), Ui.dp(c, 9));
        TextView title = Ui.text(c, "", 14, Ui.WHITE, live);
        title.setSingleLine(true);
        title.setEllipsize(TextUtils.TruncateAt.END);
        TextView subtitle = Ui.text(c, "", 12, live ? Ui.WHITE70 : Ui.WHITE50, false);
        subtitle.setSingleLine(true);
        subtitle.setEllipsize(TextUtils.TruncateAt.END);
        info.addView(title);
        info.addView(subtitle);
        root.addView(info);

        root.setTag(R.id.card_title, title);
        root.setTag(R.id.card_subtitle, subtitle);
        root.setTag(R.id.card_letter, letter);
        root.setTag(R.id.card_image, image);
        root.setTag(R.id.card_star, star);
        root.setTag(R.id.card_rating, rating);
        root.setTag(R.id.card_progress_row, progressRow);
        root.setTag(R.id.card_progress_fill, fill);
        root.setTag(R.id.card_progress_rest, rest);
        return root;
    }

    private static final class Holder extends ViewHolder {
        final View root;
        final TextView title, subtitle, letter, star, rating;
        final ImageView image;
        final LinearLayout progressRow;
        final View progressFill, progressRest;

        Holder(View view, int type) {
            super(view);
            root = view;
            if (type == Card.HEADER) {
                title = (TextView) view.getTag(R.id.card_title);
                subtitle = letter = star = rating = null;
                image = null;
                progressRow = null;
                progressFill = progressRest = null;
                return;
            }
            title = (TextView) view.getTag(R.id.card_title);
            subtitle = (TextView) view.getTag(R.id.card_subtitle);
            letter = (TextView) view.getTag(R.id.card_letter);
            image = (ImageView) view.getTag(R.id.card_image);
            star = (TextView) view.getTag(R.id.card_star);
            rating = (TextView) view.getTag(R.id.card_rating);
            progressRow = (LinearLayout) view.getTag(R.id.card_progress_row);
            progressFill = (View) view.getTag(R.id.card_progress_fill);
            progressRest = (View) view.getTag(R.id.card_progress_rest);
        }
    }
}
