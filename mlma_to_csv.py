#!/scratch/rbierma1/DAP_pheweb_20240719/pheweb_env/bin/python
import pandas as pd
import sys
from pathlib import Path
import os

if __name__ == '__main__':
    mlma_path = Path(sys.argv[1])
    csv_name = mlma_path.name.replace('.mlma','.csv')
    csv_path = os.path.join('data',csv_name)

    df = pd.read_table(mlma_path)

    df['ref'] = df['A2']
    df['alt'] = df['A1']

    df['maf'] = df['Freq'].apply(lambda f: min(f, 1-f))

    col_renames = {
        'Chr':'chrom',
        'bp':'pos',
        'ref':'ref',
        'alt':'alt',
        'p':'pval',
        'b':'beta',
        'maf':'maf',
    }

    df = df[col_renames.keys()].rename(columns=col_renames)
    df['chrom'] = df['chrom'].astype(int)
    df['pos'] = df['pos'].astype(int)
    df = df.sort_values(['chrom','pos'])

    df.to_csv(csv_path, index=False)

