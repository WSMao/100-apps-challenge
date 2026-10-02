export default async function handler(req: any, res: any) {
  // 只允許 POST 請求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { term, author, content } = req.body || {};

  if (!term || typeof term !== 'string') {
    return res.status(400).json({ error: 'Missing required field: term' });
  }

  if (!content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'Missing required field: content' });
  }

  const token = process.env.GITHUB_BOT_TOKEN;
  if (!token) {
    return res.status(500).json({
      error: 'GITHUB_BOT_TOKEN is not configured on server',
    });
  }

  // 倉庫與討論區分類配置
  const owner = process.env.GITHUB_REPO_OWNER || 'WSMao';
  const name = process.env.GITHUB_REPO_NAME || '100-apps-challenge';
  const categoryId = process.env.GITHUB_CATEGORY_ID || 'DIC_kwDOU1naVM4DGwMC'; // General category id

  const visitorName = (author && typeof author === 'string' && author.trim()) ? author.trim() : '匿名訪客';
  const formattedBody = `💬 **【訪客：${visitorName}】**\n\n${content.trim()}`;

  const queryHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': '100-Apps-Showcase-Bot',
  };

  try {
    // 1. 查找或建立討論串
    // 先查詢該 repo 內是否已經有標題符合 term 的討論串
    const searchDiscussionQuery = `
      query FindDiscussion($owner: String!, $name: String!, $categoryId: ID) {
        repository(owner: $owner, name: $name) {
          id
          discussions(first: 20, categoryId: $categoryId) {
            nodes {
              id
              title
            }
          }
        }
      }
    `;

    const searchRes = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: queryHeaders,
      body: JSON.stringify({
        query: searchDiscussionQuery,
        variables: { owner, name, categoryId },
      }),
    });

    const searchData: any = await searchRes.json();
    if (searchData.errors) {
      console.error('[GitHub API Error] Search discussion failed:', searchData.errors);
      return res.status(500).json({ error: 'Failed to search discussion', details: searchData.errors });
    }

    const repository = searchData?.data?.repository;
    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const existingDiscussions = repository.discussions?.nodes || [];
    let targetDiscussion = existingDiscussions.find((d: any) => d.title === term);

    // 2. 如果該 term 的討論串尚未建立，則由 Bot 自動建立
    if (!targetDiscussion) {
      const createDiscussionMutation = `
        mutation CreateDiscussion($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
          createDiscussion(input: {
            repositoryId: $repositoryId,
            categoryId: $categoryId,
            title: $title,
            body: $body
          }) {
            discussion {
              id
              title
            }
          }
        }
      `;

      const createRes = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: queryHeaders,
        body: JSON.stringify({
          query: createDiscussionMutation,
          variables: {
            repositoryId: repository.id,
            categoryId,
            title: term,
            body: `📌 **100 Apps Challenge 討論串：${term}**\n\n由 Giscus 與 100 Apps Showcase 自動維護。歡迎留下回饋與交流！`,
          },
        }),
      });

      const createData: any = await createRes.json();
      if (createData.errors) {
        console.error('[GitHub API Error] Create discussion failed:', createData.errors);
        return res.status(500).json({ error: 'Failed to create discussion', details: createData.errors });
      }

      targetDiscussion = createData?.data?.createDiscussion?.discussion;
    }

    if (!targetDiscussion?.id) {
      return res.status(500).json({ error: 'Unable to resolve target discussion ID' });
    }

    // 3. 呼叫 addDiscussionComment mutation 將訪客留言寫入該討論串
    const addCommentMutation = `
      mutation AddComment($discussionId: ID!, $body: String!) {
        addDiscussionComment(input: {
          discussionId: $discussionId,
          body: $body
        }) {
          comment {
            id
            url
            createdAt
          }
        }
      }
    `;

    const commentRes = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: queryHeaders,
      body: JSON.stringify({
        query: addCommentMutation,
        variables: {
          discussionId: targetDiscussion.id,
          body: formattedBody,
        },
      }),
    });

    const commentData: any = await commentRes.json();
    if (commentData.errors) {
      console.error('[GitHub API Error] Add comment failed:', commentData.errors);
      return res.status(500).json({ error: 'Failed to add comment', details: commentData.errors });
    }

    return res.status(200).json({
      success: true,
      comment: commentData?.data?.addDiscussionComment?.comment,
    });
  } catch (err: any) {
    console.error('[Server Error] Exception in guest-comment API:', err);
    return res.status(500).json({ error: 'Internal server error', message: err?.message || String(err) });
  }
}
