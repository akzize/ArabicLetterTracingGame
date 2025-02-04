for file in *.mpga; do
    ffmpeg -i "$file" -q:a 2 "${file%.mpga}.mp3"
done

