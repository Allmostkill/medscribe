"""Тесты чистой логики diarize.py. Запуск: python3 tone-service/test_diarize.py"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from diarize import assign_speakers, finalize_labels, should_diarize  # noqa: E402

# перекрытие: по времени побеждает кластер с большей суммой
assert assign_speakers([(0.0, 4.0)], [(0.0, 1.0, 0), (1.0, 4.0, 1)]) == [1]
# суммируется по нескольким сегментам одного кластера
assert assign_speakers([(0.0, 4.0)], [(0.0, 1.5, 0), (1.5, 2.0, 1), (2.0, 3.5, 0)]) == [0]

# нет перекрытия: ближайший в пределах 1 с
assert assign_speakers([(5.0, 6.0)], [(0.0, 1.0, 0), (6.5, 8.0, 1)]) == [1]
assert assign_speakers([(5.0, 6.0)], [(0.0, 4.5, 0), (7.5, 8.0, 1)]) == [0]
# дальше 1 с → None
assert assign_speakers([(5.0, 6.0)], [(0.0, 3.0, 0), (8.0, 9.0, 1)]) == [None]
assert assign_speakers([(5.0, 6.0)], []) == [None]

# перенумерация по первому появлению: кластер 3 первый → 1
assert finalize_labels([3, 0, 3, 0, 7]) == ([1, 2, 1, 2, 3], "ok")
assert finalize_labels([3, None, 0]) == ([1, None, 2], "ok")

# один голос → single, метки не нужны
assert finalize_labels([2, 2, None, 2]) == ([None, None, None, None], "single")

# пусто → skipped
assert finalize_labels([]) == ([], "skipped")
assert finalize_labels([None, None]) == ([None, None], "skipped")

# лимит длительности: [3 с, max] и есть фразы
assert should_diarize(60.0, 5, 1320.0)
assert should_diarize(1320.0, 5, 1320.0)
assert not should_diarize(1320.1, 5, 1320.0)
assert not should_diarize(2.9, 5, 1320.0)
assert not should_diarize(60.0, 0, 1320.0)

print("OK")
