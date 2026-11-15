#!/bin/sh
# Синтетический диалог для проверки разметки по голосу (macOS: say + ffmpeg).
# Запуск: make_test_dialog.sh <out_dir> [2|3] [--minutes 1|5|20] [--dual-mic] [--voices 1|2|3]
#   2 — врач и пациент, 3 — врач, мама и ребёнок; --voices 1 — один голос (разметка не должна выдумывать второго).
#   --minutes M — реплики сценария повторяются до длины не меньше M минут, у каждой случайная скорость
#     say -r 150–210 (фиксированный seed, результат повторяется).
#   --dual-mic — «две петлички на одном моноприёмнике»: каждая реплика = прямой сигнал + копия с задержкой
#     5–30 мс и ослаблением 6–12 дБ (у каждого голоса свои), всё в моно, поверх шум −50 дБ.
#   Если русских Yuri/Katya нет, а заданы новые аргументы, второй/третий голос — Milena со сдвигом высоты
#     (asetrate + atempo, длительность не меняется). Без новых аргументов поведение прежнее.
# Результат: <out_dir>/dialog.wav (16 кГц, моно) и <out_dir>/dialog.truth.json
#   [{"start":0.0,"end":3.1,"speaker":"A"}, ...] — эталон для eval_diarization.py.
# Пишет только в out_dir. Голоса берутся из `say -v '?'`.
set -eu

PAUSE=0.7

usage() { echo "usage: $0 <out_dir> [2|3] [--minutes 1|5|20] [--dual-mic] [--voices 1|2|3]" >&2; exit 2; }
OUT=
N=
MINUTES=
DUAL=0
while [ $# -gt 0 ]; do
  case "$1" in
    --minutes) [ $# -ge 2 ] || usage; MINUTES=$2; shift 2 ;;
    --dual-mic) DUAL=1; shift ;;
    --voices) [ $# -ge 2 ] || usage; N=$2; shift 2 ;;
    1|2|3) [ -n "$OUT" ] || usage; N=$1; shift ;;
    -*) usage ;;
    *) [ -z "$OUT" ] || usage; OUT=$1; shift ;;
  esac
done
[ -n "$OUT" ] || usage
N=${N:-2}
case "$N" in 1|2|3) ;; *) echo "число голосов: 1, 2 или 3" >&2; exit 2 ;; esac
case "$MINUTES" in ""|1|5|20) ;; *) echo "--minutes: 1, 5 или 20" >&2; exit 2 ;; esac
NEW=0
if [ -n "$MINUTES" ] || [ "$DUAL" = 1 ] || [ "$N" = 1 ]; then NEW=1; fi

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
SHIFT_B=
SHIFT_C=
if [ "$NEW" = 1 ] && [ -z "$VB" ]; then
  # других русских голосов нет: B и C — Milena со сдвигом высоты (ниже и выше), длительность прежняя
  VB=$VA; VC=$VA
  SHIFT_B=0.85; SHIFT_C=1.2
  echo "второй голос — Milena со сдвигом высоты (русских Yuri/Katya нет)" >&2
elif [ -n "$VB" ]; then
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

# число реплик в сценарии; целевая длина (с), 0 — один проход
printf '%s\n' "$SCRIPT" > "$TMP/script.txt"
L=$(grep -c '|' "$TMP/script.txt")
TARGET=0
[ -z "$MINUTES" ] || TARGET=$((MINUTES * 60))

# у каждого голоса свои задержка (мс) и ослабление (дБ) второго микрофона: 5–30 мс, 6–12 дБ
mic_delay() { case "$1" in A) echo 9 ;; B) echo 24 ;; *) echo 16 ;; esac; }
mic_atten() { case "$1" in A) echo 7 ;; B) echo 11 ;; *) echo 9 ;; esac; }

: > "$TMP/list.txt"
: > "$TMP/truth.txt"
t=0
i=0
while :; do
  if [ "$TARGET" = 0 ]; then [ "$i" -lt "$L" ] || break
  else awk -v t="$t" -v g="$TARGET" 'BEGIN{exit !(t<g)}' || break; fi
  line=$(grep '|' "$TMP/script.txt" | sed -n "$((i % L + 1))p")
  spk=${line%%|*}
  text=${line#*|}
  [ "$N" != 1 ] || spk=A
  case "$spk" in A) v=$VA ;; B) v=$VB ;; C) v=$VC ;; *) continue ;; esac
  i=$((i + 1))
  rate=
  if [ "$NEW" = 1 ]; then
    # скорость речи 150–210, детерминированно от номера реплики
    r=$(awk -v n="$i" 'BEGIN{srand(1000 + n); printf "%d", 150 + int(rand() * 61)}')
    rate="-r $r"
  fi
  # shellcheck disable=SC2086
  say -v "$v" $rate -o "$TMP/l$i.aiff" "$text"
  filt=
  case "$spk" in B) sh_=$SHIFT_B ;; C) sh_=$SHIFT_C ;; *) sh_= ;; esac
  if [ -n "$sh_" ]; then
    filt="asetrate=16000*$sh_,atempo=$(awk -v s="$sh_" 'BEGIN{printf "%.4f", 1 / s}'),aresample=16000"
  fi
  if [ "$DUAL" = 1 ]; then
    dm=$(mic_delay "$spk"); at=$(mic_atten "$spk")
    filt="${filt:+$filt,}asplit[a][b];[b]adelay=$dm,volume=-${at}dB[c];[a][c]amix=inputs=2:duration=longest:normalize=0"
  fi
  if [ -n "$filt" ]; then
    # aiff -> 16 кГц моно, затем сдвиг высоты и/или второй микрофон
    ffmpeg -loglevel error -y -i "$TMP/l$i.aiff" -ar 16000 -ac 1 -c:a pcm_s16le "$TMP/p$i.wav"
    ffmpeg -loglevel error -y -i "$TMP/p$i.wav" -af "$filt" -ar 16000 -ac 1 -c:a pcm_s16le "$TMP/l$i.wav"
  else
    ffmpeg -loglevel error -y -i "$TMP/l$i.aiff" -ar 16000 -ac 1 -c:a pcm_s16le "$TMP/l$i.wav"
  fi
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMP/l$i.wav")
  echo "$t $d $spk" >> "$TMP/truth.txt"
  t=$(awk -v t="$t" -v d="$d" -v p="$PAUSE" 'BEGIN{printf "%.3f", t+d+p}')
  echo "file 'l$i.wav'" >> "$TMP/list.txt"
  echo "file 'sil.wav'" >> "$TMP/list.txt"
done

if [ "$DUAL" = 1 ]; then
  ffmpeg -loglevel error -y -f concat -safe 0 -i "$TMP/list.txt" -ar 16000 -ac 1 -c:a pcm_s16le "$TMP/clean.wav"
  # шум −50 дБ (амплитуда 10^(−50/20) ≈ 0.00316) на всю длину
  ffmpeg -loglevel error -y -i "$TMP/clean.wav" -f lavfi -i "anoisesrc=r=16000:a=0.00316:c=white:seed=7" \
    -filter_complex "[0][1]amix=inputs=2:duration=first:normalize=0" -ar 16000 -ac 1 -c:a pcm_s16le "$OUT/dialog.wav"
else
  ffmpeg -loglevel error -y -f concat -safe 0 -i "$TMP/list.txt" -ar 16000 -ac 1 -c:a pcm_s16le "$OUT/dialog.wav"
fi

awk 'BEGIN{printf "["} {printf "%s{\"start\":%.3f,\"end\":%.3f,\"speaker\":\"%s\"}", (NR>1?",":""), $1, $1+$2, $3} END{print "]"}' \
  "$TMP/truth.txt" > "$OUT/dialog.truth.json"

echo "готово: $OUT/dialog.wav, $OUT/dialog.truth.json (реплик: $i; голоса A=$VA B=$VB${VC:+ C=$VC})"
