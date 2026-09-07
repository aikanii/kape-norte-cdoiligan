import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";

type Review = {
  id: string;
  user_id: string;
  rating: number;
  comment: string;
  created_at: string;
  profiles: { display_name: string } | null;
};

function Stars({ value }: { value: number }) {
  return (
    <span aria-label={`${value} out of 5`} className="text-primary">
      {"★".repeat(value)}
      <span className="text-muted-foreground">{"★".repeat(5 - value)}</span>
    </span>
  );
}

export function Reviews({ shopId }: { shopId: string }) {
  const { user } = useSession();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("reviews")
      .select("id, user_id, rating, comment, created_at")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as unknown as Omit<Review, "profiles">[];
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    let names: Record<string, string> = {};
    if (ids.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      names = Object.fromEntries(
        (profiles ?? []).map((p) => [p.id as string, p.display_name as string]),
      );
    }
    setReviews(
      rows.map((r) => ({
        ...r,
        profiles: { display_name: names[r.user_id] ?? "Coffee lover" },
      })),
    );
  };


  useEffect(() => {
    void load();
  }, [shopId]);

  const mine = reviews.find((r) => r.user_id === user?.id) ?? null;

  useEffect(() => {
    if (mine) {
      setRating(mine.rating);
      setComment(mine.comment);
    }
  }, [mine?.id]);

  const average =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setStatus(null);
    const { error } = await supabase.from("reviews").upsert(
      {
        shop_id: shopId,
        user_id: user.id,
        rating,
        comment: comment.trim().slice(0, 1000),
      },
      { onConflict: "shop_id,user_id" },
    );
    setSaving(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus("Thanks — your review is saved.");
    void load();
  };

  const remove = async () => {
    if (!mine) return;
    await supabase.from("reviews").delete().eq("id", mine.id);
    setComment("");
    setRating(5);
    setStatus("Review deleted.");
    void load();
  };

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-2xl font-semibold text-foreground">Reviews</h2>
        {average && (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{average}</span> average ·{" "}
            {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
          </p>
        )}
      </div>

      {user ? (
        <form
          onSubmit={submit}
          className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Your rating</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={`${n} star`}
                className={`text-xl ${n <= rating ? "text-primary" : "text-muted-foreground"}`}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="How was the coffee, the seating, the Wi-Fi?"
            className="mt-3 w-full rounded-lg border border-input bg-background p-3 text-sm text-foreground outline-none focus:border-primary"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {mine ? "Update review" : "Post review"}
            </button>
            {mine && (
              <button
                type="button"
                onClick={remove}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Delete
              </button>
            )}
            {status && <span className="text-sm text-muted-foreground">{status}</span>}
          </div>
        </form>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          <Link to="/auth" className="text-primary hover:underline">
            Sign in
          </Link>{" "}
          to rate this shop and leave a comment.
        </p>
      )}

      <ul className="mt-5 flex flex-col gap-3">
        {reviews.map((r) => (
          <li key={r.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-foreground">
                {r.profiles?.display_name ?? "Coffee lover"}
              </span>
              <Stars value={r.rating} />
            </div>
            {r.comment && <p className="mt-2 text-sm text-foreground/80">{r.comment}</p>}
          </li>
        ))}
        {reviews.length === 0 && (
          <li className="text-sm text-muted-foreground">No reviews yet — be the first.</li>
        )}
      </ul>
    </section>
  );
}
