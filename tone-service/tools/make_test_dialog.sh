#!/bin/sh
# Синтетический диалог для проверки разметки по голосу (macOS: say + ffmpeg).
# Запуск: make_test_dialog.sh <out_dir> [2|3]   (2 — врач и пациент, 3 — врач, мама и ребёнок)
# Результат: <out_dir>/dialog.wav (16 кГц, моно) и <out_dir>/dialog.truth.json
#   [{"start":0.0,"end":3.1,"speaker":"A"}, ...] — эталон для eval_diarization.py.
# Пишет только в out_dir. Голоса берутся из `say -v '?'`.
set -eu

PAUSE=0.7

if [ $# -lt 1 ] || [ $# -gt 2 ]; then
  echo "usage: $0 <out_dir> [2|3]" >&2
  exit 2
fi
OUT=$1
N=${2:-2}
case "$N" in 2|3) ;; *) echo "число голосов: 2 или 3" >&2; exit 2 ;; esac

for tool in say ffmpeg ffprobe awk; do
  command -v "$tool" >/dev/null 2>&1 || { echo "нужен $tool (macOS + ffmpeg)" >&2; exit 1; }
done

VOICES=$(say -v '?' | awk '{print $1}')
has_voice() { printf '%s\n' "$VOICES" | grep -qx "$1"; }
first_voice() { # первый установленный из списка, иначе пусто
  for v in "$@"; do
    if has_voice "$v"; then echo "$v"; return; fi
  done
}

# A — врач: Milena; B и C — русские Yuri/Katya, иначе английские (годятся только для разметки голосов)
VA=$(first_voice Milena)
[ -n "$VA" ] || { echo "не найден русский голос Milena (say -v '?')" >&2; exit 1; }
VB=$(first_voice Yuri Katya)
if [ -n "$VB" ]; then
  VC=$(first_voice Katya Yuri)
  [ "$VC" != "$VB" ] || VC=
else
  VB=$(first_voice Daniel Samantha)
  VC=$(first_voice Samantha Daniel)
  [ "$VC" != "$VB" ] || VC=
  echo "ВНИМАНИЕ: Yuri/Katya не установлены, B/C говорят английским голосом: годится только для проверки разметки по голосу, не для распознавания" >&2
fi
[ -n "$VB" ] || { echo "нет второго голоса" >&2; exit 1; }
if [ "$N" = 3 ] && [ -z "$VC" ]; then
  # третий голос: любой другой английский
  for v in Daniel Samantha Alex Fred Karen Moira Tessa; do
    if has_voice "$v" && [ "$v" != "$VB" ]; then VC=$v; break; fi
  done
  [ -n "$VC" ] || { echo "нет третьего голоса" >&2; exit 1; }
  echo "ВНИМАНИЕ: третий голос $VC — только для проверки разметки по голосу" >&2
fi

# Реплики: "метка|текст". Русский текст читает и английский голос (на слух чепуха, но голос различим).
if [ "$N" = 2 ]; then
  SCRIPT='A|Здравствуйте, присаживайтесь. Что вас беспокоит?
B|Здравствуйте, доктор. Уже две недели болит голова, в основном по вечерам.
A|Где именно болит и как давно это началось?
B|Болит в затылке, иногда кружится голова. Началось после тяжёлого месяца на работе.
A|Принимали ли вы какие-нибудь лекарства от боли?
B|Да, пил ибупрофен два раза в день, но помогает всего на несколько часов.
A|Давайте измерим давление. Сто пятьдесят на девяносто пять, это повышено.
B|Это опасно? У моего отца тоже было высокое давление.
A|Есть наследственная предрасположенность, поэтому обследоваться нужно обязательно.
B|Хорошо, что мне нужно сделать?
A|Я назначу анализы крови и суточное мониторирование давления. Придите через неделю.
B|Спасибо, доктор, приду в понедельник с результатами.'
else
  SCRIPT='A|Здравствуйте, проходите. Расскажите, что случилось с мальчиком?
B|Здравствуйте, доктор. У сына уже месяц болит голова, особенно после школы.
A|Сколько ему лет? Сынок, где у тебя болит?
C|Вот здесь, во лбу.
B|Ему девять лет. Ещё он стал хуже спать и часто жалуется на усталость.
A|Он много сидит за компьютером или телефоном?
C|Немножко играю.
B|Ну, по два-три часа каждый день, если честно.
A|Понятно. Давайте посмотрим глазки и проверим рефлексы. Следи за моим пальцем.
C|Я смотрю.
A|Неврологический статус без особенностей. Нужно ограничить экраны и наладить режим сна.
B|Спасибо, доктор, а лекарства какие-нибудь нужны?
A|Пока без лекарств. Придите через месяц, и мы оценим динамику.'
fi

mkdir -p "$OUT"
TMP=$(mktemp -d "$OUT/.tmp.XXXXXX")
trap 'rm -rf "$TMP"' EXIT INT TERM

ffmpeg -loglevel error -y -f lavfi -i anullsrc=r=16000:cl=mono -t "$PAUSE" -c:a pcm_s16le "$TMP/sil.wav"

: > "$TMP/list.txt"
: > "$TMP/truth.txt"
t=0
i=0
printf '%s\n' "$SCRIPT" > "$TMP/script.txt"
while IFS='|' read -r spk text; do
  case "$spk" in A) v=$VA ;; B) v=$VB ;; C) v=$VC ;; *) continue ;; esac
  i=$((i + 1))
  say -v "$v" -o "$TMP/l$i.aiff" "$text"
  ffmpeg -loglevel error -y -i "$TMP/l$i.aiff" -ar 16000 -ac 1 -c:a pcm_s16le "$TMP/l$i.wav"
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMP/l$i.wav")
  echo "$t $d $spk" >> "$TMP/truth.txt"
  t=$(awk -v t="$t" -v d="$d" -v p="$PAUSE" 'BEGIN{printf "%.3f", t+d+p}')
  echo "file 'l$i.wav'" >> "$TMP/list.txt"
  echo "file 'sil.wav'" >> "$TMP/list.txt"
done < "$TMP/script.txt"

ffmpeg -loglevel error -y -f concat -safe 0 -i "$TMP/list.txt" -ar 16000 -ac 1 -c:a pcm_s16le "$OUT/dialog.wav"

awk 'BEGIN{printf "["} {printf "%s{\"start\":%.3f,\"end\":%.3f,\"speaker\":\"%s\"}", (NR>1?",":""), $1, $1+$2, $3} END{print "]"}' \
  "$TMP/truth.txt" > "$OUT/dialog.truth.json"

echo "готово: $OUT/dialog.wav, $OUT/dialog.truth.json (реплик: $i; голоса A=$VA B=$VB${VC:+ C=$VC})"
