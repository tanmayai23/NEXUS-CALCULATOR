"""Train Class 12 NCERT chapter-wise model (Part 1 + Part 2)."""

from training.train_ncert import main

if __name__ == "__main__":
    import sys

    sys.argv.extend(["--grade", "12"])
    main()
