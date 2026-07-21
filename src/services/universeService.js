import { supabase } from "../supabaseClient";

export async function getNodes() {
  const { data, error } = await supabase
    .from("brain_nodes")
    .select("*")
    .order("created_at");

  if (error) throw error;
  return data ?? [];
}

export async function createNodeQuick() {
  const { data, error } = await supabase
    .from("brain_nodes")
    .insert({
      title: "Nouvelle bulle",
      category: "Divers",
      type: "idea",
      x: Math.random() * 800,
      y: Math.random() * 600,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateNodePosition(id, x, y) {
  const { error } = await supabase
    .from("brain_nodes")
    .update({ x, y })
    .eq("id", id);

  if (error) throw error;
}
