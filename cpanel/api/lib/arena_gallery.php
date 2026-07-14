<?php

/** @return list<string> */
function normalize_arena_gallery_images(mixed $raw): array {
  if (!is_array($raw)) return [];
  $out = [];
  foreach ($raw as $item) {
    $url = trim((string)$item);
    if ($url === '') continue;
    if (in_array($url, $out, true)) continue;
    $out[] = mb_substr($url, 0, 2048);
    if (count($out) >= 8) break;
  }
  return $out;
}
