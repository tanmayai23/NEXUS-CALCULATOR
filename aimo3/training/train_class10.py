"""Train Class 10 NCERT chapter-wise model."""

from training.train_ncert import main

if __name__ == "__main__":
    import sys

    sys.argv.extend(["--grade", "10"])
    main()
