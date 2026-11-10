#!/bin/bash
# OCR sách PDF (chữ đã chuyển thành hình) bằng Tesseract, mô hình tiếng Việt chất lượng cao (tessdata_best/vie).
# Dùng (Linux/WSL): ./ocr_sach.sh <tệp.pdf> <thư-mục-ra> <số-trang> <số-luồng> <thư-mục-tessdata>
# Cần: poppler-utils (pdftoppm), tesseract, tệp vie.traineddata bản "best".
pdf=$1; out=$2; n=$3; P=${4:-2}; TD=${5:-td}; mkdir -p "$out"
seq 1 "$n" | xargs -P "$P" -I{} bash -c 'f=$(printf "%s/%03d" '"$out"' {}); [ -s $f.txt ] && exit 0; pdftoppm -r 300 -gray -f {} -l {} -singlefile -png '"$pdf"' $f && OMP_THREAD_LIMIT=1 tesseract $f.png $f --tessdata-dir '"$TD"' -l vie --psm 3 >/dev/null 2>&1; rm -f $f.png'
