import { NextRequest, NextResponse } from 'next/server';
import { getAllRepositories } from '@/src/shared/services/github';

type RepositoryType = 'all' | 'owner' | 'public' | 'private';
type SortType = 'created' | 'updated' | 'pushed' | 'full_name';
type DirectionType = 'asc' | 'desc';

export async function GET(request: NextRequest) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const type = searchParams.get('type') as RepositoryType || 'all';
    const sort = searchParams.get('sort') as SortType || 'updated';
    const direction = searchParams.get('direction') as DirectionType || 'desc';
    const perPage = parseInt(searchParams.get('per_page') as string) || 10;

    const repositories = await getAllRepositories({
      type,
      sort,
      direction,
      per_page: perPage,
    });

    return NextResponse.json(repositories);
  } catch (error) {
    console.error('Error fetching repositories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repositories' },
      { status: 500 }
    );
  }
}
