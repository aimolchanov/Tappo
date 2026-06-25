import os
import random

folder = input("Путь к папке: ").strip().strip('"')
prefix = input("Префикс (например coloring_ или puzzle_): ").strip()
start = int(input("Стартовый номер (например 1 или 8): ").strip())

files = [
    f for f in os.listdir(folder)
    if os.path.isfile(os.path.join(folder, f))
]

if not files:
    print("Папка пуста или путь неверный.")
    exit(1)

random.shuffle(files)

print(f"\nНайдено файлов: {len(files)}")
print("Переименование:")

for i, filename in enumerate(files):
    ext = os.path.splitext(filename)[1].lower()
    new_name = f"{prefix}{start + i}{ext}"
    src = os.path.join(folder, filename)
    dst = os.path.join(folder, new_name)
    os.rename(src, dst)
    print(f"  {filename}  →  {new_name}")

print("\nГотово!")
