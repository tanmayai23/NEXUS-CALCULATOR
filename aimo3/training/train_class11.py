"""Train Class 11 NCERT chapter-wise model."""

from training.train_ncert import main

if __name__ == "__main__":
    import sys

    sys.argv.extend(["--grade", "11"])
    main()
