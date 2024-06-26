import pandas as pd
import sys
from pathlib import Path

if __name__ == '__main__':
    mlma_path = Path(sys.argv[1])
    csv_path = mlma_path.with_suffix('.csv')

    df = pd.read_table(mlma_path)

    df['ref'] = df['SNP'].str.split(':').str[2]
    df['alt'] = df['SNP'].str.split(':').str[3]

    col_renames = {
        'Chr':'chrom',
        'bp':'pos',
        'ref':'ref',
        'alt':'alt',
        'p':'pval',
    }

    df = df[col_renames.keys()].rename(columns=col_renames)

    df.to_csv(csv_path, index=False)

